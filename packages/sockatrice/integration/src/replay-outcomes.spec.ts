import { create, setExtension, toBinary } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';
import * as Data from '../../src/generated';
import { SessionCommands, WebClient } from '../../src';
import { connectAndLogin, getMockResponse, getMockWebSocket } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, buildSessionEventMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

const failures = [
  {
    name: 'delete',
    send: (failure?: (code: number) => void) => SessionCommands.replayDeleteMatch(42, failure),
    capture: () => findLastSessionCommand(Data.Command_ReplayDeleteMatch_ext),
    expected: { gameId: 42 },
  },
  {
    name: 'modify',
    send: (failure?: (code: number) => void) => SessionCommands.replayModifyMatch(42, false, failure),
    capture: () => findLastSessionCommand(Data.Command_ReplayModifyMatch_ext),
    expected: { gameId: 42, doNotHide: false },
  },
  {
    name: 'download',
    send: (failure?: (code: number) => void) => SessionCommands.replayDownload(42, undefined, failure),
    capture: () => findLastSessionCommand(Data.Command_ReplayDownload_ext),
    expected: { replayId: 42 },
  },
];

describe('replay command outcomes', () => {
  it.each(failures)('$name reports rejection without a success response', ({ send, capture, expected }) => {
    connectAndLogin();
    const failure = vi.fn();
    const socket = getMockWebSocket();
    socket.send.mockClear();
    send(failure);
    const { cmdId, value } = capture();
    expect({ ...value }).toEqual({ $typeName: value.$typeName, ...expected });
    expect(socket.send.mock.calls).toHaveLength(1);
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespNameNotFound })));
    expect(failure.mock.calls).toEqual([[Data.Response_ResponseCode.RespNameNotFound, undefined]]);
    const session = getMockResponse().session;
    expect(session.replayDeleteMatch.mock.calls).toEqual([]);
    expect(session.replayModifyMatch.mock.calls).toEqual([]);
    expect(session.replayDownloaded.mock.calls).toEqual([]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      send();
      const next = capture();
      expect({ ...next.value }).toEqual({ $typeName: next.value.$typeName, ...expected });
      deliverMessage(buildResponseMessage(buildResponse({ cmdId: next.cmdId, responseCode: Data.Response_ResponseCode.RespNameNotFound })));
      expect(socket.send.mock.calls).toHaveLength(2);
      expect(failure.mock.calls).toEqual([[Data.Response_ResponseCode.RespNameNotFound, undefined]]);
      expect(session.replayDeleteMatch.mock.calls).toEqual([]);
      expect(session.replayModifyMatch.mock.calls).toEqual([]);
      expect(session.replayDownloaded.mock.calls).toEqual([]);
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('getCode rejects without delivering a share code', () => {
    connectAndLogin();
    const received = vi.fn();
    const failure = vi.fn();
    SessionCommands.replayGetCode(42, received, failure);
    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayGetCode_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, gameId: 42 });
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed })));
    expect(failure.mock.calls).toEqual([[Data.Response_ResponseCode.RespFunctionNotAllowed, undefined]]);
    expect(received.mock.calls).toEqual([]);
  });

  it('delivers download bytes only to the requesting callback', () => {
    connectAndLogin();
    const downloaded = vi.fn();
    const failure = vi.fn();
    SessionCommands.replayDownload(42, downloaded, failure);
    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayDownload_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, replayId: 42 });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayDownload_ext,
      value: create(Data.Response_ReplayDownloadSchema, { replayData: new Uint8Array([9, 7, 5]) }),
    })));
    expect(downloaded.mock.calls).toEqual([[new Uint8Array([9, 7, 5])]]);
    expect(failure.mock.calls).toEqual([]);
    expect(getMockResponse().session.replayDownloaded.mock.calls).toEqual([]);
  });

  it('refreshes the list for a grant without match info and completes that request', () => {
    connectAndLogin();
    const socket = getMockWebSocket();
    socket.send.mockClear();
    deliverMessage(buildSessionEventMessage(Data.Event_ReplayAdded_ext, create(Data.Event_ReplayAddedSchema)));
    expect(socket.send.mock.calls).toHaveLength(1);
    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayList_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName });
    const match = create(Data.ServerInfo_ReplayMatchSchema, { gameId: 42, gameName: 'Granted' });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayList_ext, value: create(Data.Response_ReplayListSchema, { matchList: [match] }),
    })));
    expect(getMockResponse().session.replayList.mock.calls).toEqual([[[match]]]);
    expect(getMockResponse().session.replayAdded.mock.calls).toEqual([]);
    deliverMessage(buildSessionEventMessage(Data.Event_ReplayAdded_ext, create(Data.Event_ReplayAddedSchema, { matchInfo: match })));
    expect(getMockResponse().session.replayAdded.mock.calls).toEqual([[match]]);
    expect(socket.send.mock.calls).toHaveLength(1);
  });
});

describe('offline replay dispatch', () => {
  it('loads, feeds and unloads a local replay without sending traffic', () => {
    connectAndLogin();
    const client = WebClient.instance;
    client.disconnect();
    const socket = getMockWebSocket();
    socket.send.mockClear();
    const loaded = vi.mocked(getMockResponse().game.replayGameLoaded!);
    const unloaded = vi.mocked(getMockResponse().game.replayGameUnloaded!);
    const info = create(Data.ServerInfo_GameSchema, { gameId: 42 });
    client.loadReplayGame(-1000, info);
    const event = create(Data.GameEventSchema, { playerId: 3 });
    setExtension(event, Data.Event_GameSay_ext, create(Data.Event_GameSaySchema, { message: 'recorded chat' }));
    const now = Date.now();
    client.replayGameEventContainer(create(Data.GameEventContainerSchema, { gameId: 42, eventList: [event] }), -1000);
    client.replayGameEventContainer(create(Data.GameEventContainerSchema), -1000);
    client.unloadReplayGame(-1000);
    expect(loaded.mock.calls).toEqual([[-1000, info]]);
    expect(getMockResponse().game.gameSay.mock.calls).toEqual([[-1000, 3, 'recorded chat', now]]);
    expect(unloaded.mock.calls).toEqual([[-1000]]);
    expect(socket.send.mock.calls).toEqual([]);
  });

  it('ignores a live game envelope with no container', () => {
    connectAndLogin();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      deliverMessage(toBinary(Data.ServerMessageSchema, create(Data.ServerMessageSchema, {
        messageType: Data.ServerMessage_MessageType.GAME_EVENT_CONTAINER,
      })));
      expect(getMockResponse().game.gameSay.mock.calls).toEqual([]);
      expect(getMockResponse().game.gameClosed.mock.calls).toEqual([]);
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
