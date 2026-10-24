
import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import * as Data from '../../src/generated';
import { RoomCommands, SessionCommands } from '../../src';
import { DEFAULT_COMMAND_TIMEOUT_MS } from '../../src/services/ProtobufService';
import { WebsocketTypes } from '../../src/types';

import { connectAndHandshake, connectAndLogin, connectRaw, getMockResponse, getMockWebSocket, getWebClient } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { findLastRoomCommand, findLastSessionCommand } from '../../src/testing/command-capture';

describe('command outcomes', () => {
  it('fails an unanswered deck list with a timeout after the default deadline', () => {
    connectAndLogin();
    SessionCommands.deckList();

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS - 1);
    expect(getMockResponse().session.deckListFailed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(getMockResponse().session.deckListFailed).toHaveBeenCalledTimes(1);
    expect(getMockResponse().session.deckListFailed).toHaveBeenCalledWith(
      Data.Response_ResponseCode.RespNotConnected,
      WebsocketTypes.CommandFailure.Timeout,
    );
  });

  it('ignores the server\'s answer when it arrives after the deadline', () => {
    connectAndLogin();
    SessionCommands.deckDownload(7);
    const { cmdId } = findLastSessionCommand(Data.Command_DeckDownload_ext);

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckDownload_ext,
      value: create(Data.Response_DeckDownloadSchema, { deck: '<cockatrice_deck/>' }),
    })));

    expect(getMockResponse().session.deckDownloadFailed).toHaveBeenCalledTimes(1);
    expect(getMockResponse().session.downloadServerDeck).not.toHaveBeenCalled();
  });

  it('fails an in-flight join-game as disconnected when the socket drops, and settles the join dialog', () => {
    connectAndLogin();
    RoomCommands.joinGame(1, create(Data.Command_JoinGameSchema, { gameId: 42 }));
    expect(() => findLastRoomCommand(Data.Command_JoinGame_ext)).not.toThrow();

    const mock = getMockWebSocket();
    mock.readyState = 3;
    mock.onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);

    expect(getMockResponse().room.setJoinGameError).toHaveBeenCalledTimes(1);
    expect(getMockResponse().room.setJoinGameError).toHaveBeenCalledWith(
      Data.Response_ResponseCode.RespNotConnected,
      '',
      WebsocketTypes.CommandFailure.Disconnected,
    );

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(getMockResponse().room.setJoinGameError).toHaveBeenCalledTimes(1);
  });

  it('settles commands in flight when connect() replaces an open socket', () => {
    connectAndHandshake();
    expect(() => findLastSessionCommand(Data.Command_Login_ext)).not.toThrow();

    connectRaw();
    expect(getMockResponse().session.loginFailed).toHaveBeenCalledTimes(1);
    const status = getWebClient().status;

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(getMockResponse().session.loginFailed).toHaveBeenCalledTimes(1);
    expect(getWebClient().status).toBe(status);
    expect(getMockResponse().session.updateStatus).not.toHaveBeenCalledWith(
      WebsocketTypes.StatusEnum.DISCONNECTED,
      'Login failed: the server did not respond',
    );
  });
});
