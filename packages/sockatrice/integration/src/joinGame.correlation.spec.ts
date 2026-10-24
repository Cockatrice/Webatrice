import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';
import * as Data from '../../src/generated';
import { RoomCommands } from '../../src';
import { DEFAULT_COMMAND_TIMEOUT_MS } from '../../src/services/ProtobufService';
import { WebsocketTypes } from '../../src/types';
import { connectAndLogin, getMockResponse, getWebClient } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { findLastRoomCommand } from '../../src/testing/command-capture';

describe('join-game correlation over the transport', () => {
  it('keeps identities attached to reordered responses for the same game', () => {
    connectAndLogin();
    RoomCommands.joinGame(1, create(Data.Command_JoinGameSchema, { gameId: 42 }), 'join-old');
    const oldJoin = findLastRoomCommand(Data.Command_JoinGame_ext);
    RoomCommands.joinGame(1, create(Data.Command_JoinGameSchema, { gameId: 42 }), 'join-new');
    const newJoin = findLastRoomCommand(Data.Command_JoinGame_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: newJoin.cmdId, responseCode: Data.Response_ResponseCode.RespOk,
    })));
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: oldJoin.cmdId, responseCode: Data.Response_ResponseCode.RespWrongPassword,
    })));
    expect(getMockResponse().room.joinedGame).toHaveBeenCalledWith(1, 42, 'join-new');
    expect(getMockResponse().room.setJoinGameError).toHaveBeenCalledWith(
      Data.Response_ResponseCode.RespWrongPassword, '', undefined, 'join-old',
    );
  });

  it('reports the timed-out request identity exactly once and ignores its late response', () => {
    connectAndLogin();
    RoomCommands.joinGame(1, create(Data.Command_JoinGameSchema, { gameId: 42 }), 'join-a');
    const { cmdId } = findLastRoomCommand(Data.Command_JoinGame_ext);
    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespOk })));
    expect(getMockResponse().room.setJoinGameError).toHaveBeenCalledExactlyOnceWith(
      Data.Response_ResponseCode.RespNotConnected, '', WebsocketTypes.CommandFailure.Timeout, 'join-a',
    );
    expect(getMockResponse().room.joinedGame).not.toHaveBeenCalled();
  });

  it('does not report an old join error when an intentional disconnect ends the session', () => {
    connectAndLogin();
    RoomCommands.joinGame(1, create(Data.Command_JoinGameSchema, { gameId: 42 }), 'join-old');
    vi.mocked(getMockResponse().room.setJoinGamePending).mockClear();
    getWebClient().disconnect();
    expect(getMockResponse().session.updateStatus).toHaveBeenCalledWith(
      WebsocketTypes.StatusEnum.DISCONNECTED, expect.any(String),
    );
    expect(getMockResponse().room.setJoinGameError).not.toHaveBeenCalled();
    expect(getMockResponse().room.setJoinGamePending).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(getMockResponse().room.setJoinGameError).not.toHaveBeenCalled();
  });
});
