// Replay flow scenarios — end-to-end protocol wiring for the replay-sharing
// commands (submitCode/getCode/download/modifyMatch) plus the replayAdded
// session event. Per [[project_replay-sharing-deferred-ui]] the command
// wrappers exist already; these tests exercise them with the mock WebSocket.

import { create, fromBinary, setExtension, toBinary } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import * as Data from '../../src/generated';
import { SessionCommands } from '../../src';

import { connectAndLogin, connectRaw, getMockResponse, getMockWebSocket, getWebClient } from '../../src/testing/setup';
import {
  buildGameEventMessage,
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

describe('replay-flow: submit code → server stores → fetch code → download replay', () => {
  it('replaySubmitCode sends Command_ReplaySubmitCode with the supplied code', () => {
    connectAndLogin();

    SessionCommands.replaySubmitCode('ABC-123');

    const { value } = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    expect(value.replayCode).toBe('ABC-123');
  });

  it('replaySubmitCode invokes onSubmitted callback on RespOk', () => {
    connectAndLogin();

    const onSubmitted = vi.fn();
    SessionCommands.replaySubmitCode('XYZ-789', onSubmitted);

    const { cmdId } = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it('replaySubmitCode invokes onFailure with response code on non-Ok response', () => {
    connectAndLogin();

    const onSubmitted = vi.fn();
    const onFailure = vi.fn();
    SessionCommands.replaySubmitCode('BAD-CODE', onSubmitted, onFailure);

    const { cmdId } = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespNameNotFound,
    })));

    expect(onSubmitted).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toBe(Data.Response_ResponseCode.RespNameNotFound);
  });

  it('replayGetCode round-trip delivers the replay code via the callback', () => {
    connectAndLogin();

    const onCodeReceived = vi.fn();
    SessionCommands.replayGetCode(42, onCodeReceived);

    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayGetCode_ext);
    expect(value.gameId).toBe(42);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayGetCode_ext,
      value: create(Data.Response_ReplayGetCodeSchema, { replayCode: 'SHARED-CODE-9' }),
    })));

    expect(onCodeReceived).toHaveBeenCalledWith('SHARED-CODE-9');
  });

  it('replayDownload dispatches replayDownloaded with the replay payload', () => {
    connectAndLogin();

    SessionCommands.replayDownload(99);

    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayDownload_ext);
    expect(value.replayId).toBe(99);

    const replayData = new Uint8Array([1, 2, 3, 4, 5]);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayDownload_ext,
      value: create(Data.Response_ReplayDownloadSchema, { replayData }),
    })));

    expect(getMockResponse().session.replayDownloaded).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ replayData: expect.any(Uint8Array) }),
    );
  });

  it('replayModifyMatch round-trip dispatches replayModifyMatch with gameId and doNotHide', () => {
    connectAndLogin();

    SessionCommands.replayModifyMatch(99, true);

    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayModifyMatch_ext);
    expect(value.gameId).toBe(99);
    expect(value.doNotHide).toBe(true);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().session.replayModifyMatch).toHaveBeenCalledWith(99, true);
  });

  it('Event_ReplayAdded dispatches session.replayAdded with the match info', () => {
    connectAndLogin();

    const matchInfo = create(Data.ServerInfo_ReplayMatchSchema, {
      gameId: 555,
      gameName: 'Shared Replay',
      roomName: 'Lobby',
      timeStarted: 1000,
      length: 60,
      playerNames: ['alice', 'bob'],
      doNotHide: false,
      replayList: [
        create(Data.ServerInfo_ReplaySchema, {
          replayId: 1,
          replayName: 'Game 1',
          duration: 60,
        }),
      ],
    });
    deliverMessage(buildSessionEventMessage(
      Data.Event_ReplayAdded_ext,
      create(Data.Event_ReplayAddedSchema, { matchInfo })
    ));

    expect(getMockResponse().session.replayAdded).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 555, gameName: 'Shared Replay' }),
    );
  });

  it('full flow: submit code, list replays, fetch code, download, modify visibility', () => {
    connectAndLogin();

    SessionCommands.replaySubmitCode('FULL-FLOW');
    const submit = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: submit.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    SessionCommands.replayList();
    const list = findLastSessionCommand(Data.Command_ReplayList_ext);
    const match = create(Data.ServerInfo_ReplayMatchSchema, {
      gameId: 700,
      gameName: 'Tournament Round 1',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: list.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayList_ext,
      value: create(Data.Response_ReplayListSchema, { matchList: [match] }),
    })));
    expect(getMockResponse().session.replayList).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ gameId: 700 })]),
    );

    const onCodeReceived = vi.fn();
    SessionCommands.replayGetCode(700, onCodeReceived);
    const getCode = findLastSessionCommand(Data.Command_ReplayGetCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: getCode.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayGetCode_ext,
      value: create(Data.Response_ReplayGetCodeSchema, { replayCode: 'CODE-700' }),
    })));
    expect(onCodeReceived).toHaveBeenCalledWith('CODE-700');

    SessionCommands.replayDownload(700);
    const dl = findLastSessionCommand(Data.Command_ReplayDownload_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: dl.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayDownload_ext,
      value: create(Data.Response_ReplayDownloadSchema, { replayData: new Uint8Array([9, 9, 9]) }),
    })));
    expect(getMockResponse().session.replayDownloaded).toHaveBeenCalledWith(700, expect.anything());

    SessionCommands.replayModifyMatch(700, false);
    const modify = findLastSessionCommand(Data.Command_ReplayModifyMatch_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: modify.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));
    expect(getMockResponse().session.replayModifyMatch).toHaveBeenCalledWith(700, false);
  });
});

describe('replay game clock', () => {
  function recordedChat(secondsElapsed?: number) {
    const event = create(Data.GameEventSchema, { playerId: 7 });
    setExtension(event, Data.Event_GameSay_ext, create(Data.Event_GameSaySchema, { message: 'Recorded chat' }));
    const container = create(Data.GameEventContainerSchema, { eventList: [event] });
    if (secondsElapsed !== undefined) {
      container.secondsElapsed = secondsElapsed;
    }
    return fromBinary(Data.GameEventContainerSchema, toBinary(Data.GameEventContainerSchema, container));
  }

  it('reports recorded time, including zero, before dispatching each container through the event registry', () => {
    connectRaw();
    vi.setSystemTime(9_000);
    const response = getMockResponse().game;
    const order = vi.fn();
    vi.mocked(response.replayGameTimeSynced!).mockImplementation((...args) => order('clock', ...args));
    vi.mocked(response.gameSay).mockImplementation((...args) => order('chat', ...args));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      getWebClient().replayGameEventContainer(recordedChat(95), -1001);
      getWebClient().replayGameEventContainer(recordedChat(0), -1001);

      expect(vi.mocked(response.replayGameTimeSynced!).mock.calls).toEqual([[-1001, 95], [-1001, 0]]);
      expect(vi.mocked(response.gameSay).mock.calls).toEqual([
        [-1001, 7, 'Recorded chat', 9_000],
        [-1001, 7, 'Recorded chat', 9_000],
      ]);
      expect(order.mock.calls).toEqual([
        ['clock', -1001, 95],
        ['chat', -1001, 7, 'Recorded chat', 9_000],
        ['clock', -1001, 0],
        ['chat', -1001, 7, 'Recorded chat', 9_000],
      ]);
      expect(getMockWebSocket().send.mock.calls).toEqual([]);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('dispatches an untimed container without reporting the protobuf default as a recorded time', () => {
    connectRaw();
    vi.setSystemTime(9_000);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      getWebClient().replayGameEventContainer(recordedChat(), -1001);

      expect(vi.mocked(getMockResponse().game.replayGameTimeSynced!).mock.calls).toEqual([]);
      expect(vi.mocked(getMockResponse().game.gameSay).mock.calls).toEqual([[-1001, 7, 'Recorded chat', 9_000]]);
      expect(getMockWebSocket().send.mock.calls).toEqual([]);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it('dispatches a timed container when the response implementation omits clock notifications', () => {
    connectRaw();
    vi.setSystemTime(9_000);
    const client = getWebClient();
    const original = client.response.game;
    const gameSay = vi.fn();
    client.response.game = { gameSay } as typeof original;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      client.replayGameEventContainer(recordedChat(95), -1001);

      expect(gameSay.mock.calls).toEqual([[-1001, 7, 'Recorded chat', 9_000]]);
      expect(getMockWebSocket().send.mock.calls).toEqual([]);
      expect(errors.mock.calls).toEqual([]);
    } finally {
      client.response.game = original;
      errors.mockRestore();
    }
  });
});

describe('replay reveal options', () => {
  it.each([undefined, {}, { skipRevealWindow: false }, { skipRevealWindow: true }])(
    'forwards options %j to recorded reveals and leaves subsequent live and playback events unchanged',
    (options) => {
      const recordedGameId = 42;
      const replayGameId = -1000;
      const firstPlayerId = 3;
      const secondPlayerId = 4;
      const cardId = 17;
      const secondsElapsed = 12;
      connectRaw();
      const client = getWebClient();
      const response = getMockResponse().game;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const payload = create(Data.Event_RevealCardsSchema, {
          zoneName: 'hand',
          cards: [{ id: cardId, name: 'Island' }],
          grantWriteAccess: true,
        });
        const events = [firstPlayerId, secondPlayerId].map((playerId) => {
          const event = create(Data.GameEventSchema, { playerId });
          setExtension(event, Data.Event_RevealCards_ext, payload);
          return event;
        });
        const container = create(Data.GameEventContainerSchema, {
          gameId: recordedGameId, secondsElapsed, eventList: events,
        });

        client.replayGameEventContainer(container, replayGameId, options);
        deliverMessage(buildGameEventMessage({
          gameId: recordedGameId, playerId: firstPlayerId, ext: Data.Event_RevealCards_ext, value: payload,
        }));
        client.replayGameEventContainer(container, replayGameId);

        const expectedPayload = create(Data.Event_RevealCardsSchema, {
          zoneName: 'hand', cards: [{ id: cardId, name: 'Island' }], grantWriteAccess: true,
        });
        expect(vi.mocked(response.cardsRevealed).mock.calls).toEqual([
          [replayGameId, firstPlayerId, expectedPayload, options],
          [replayGameId, secondPlayerId, expectedPayload, options],
          [recordedGameId, firstPlayerId, expectedPayload, undefined],
          [replayGameId, firstPlayerId, expectedPayload, undefined],
          [replayGameId, secondPlayerId, expectedPayload, undefined],
        ]);
        expect(vi.mocked(response.replayGameTimeSynced!).mock.calls).toEqual([
          [replayGameId, secondsElapsed], [replayGameId, secondsElapsed],
        ]);
        expect(getMockWebSocket().send.mock.calls).toEqual([]);
        expect(errorSpy.mock.calls).toEqual([]);
      } finally {
        errorSpy.mockRestore();
      }
    },
  );
});
