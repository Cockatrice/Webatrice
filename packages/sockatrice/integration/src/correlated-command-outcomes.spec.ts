import { describe, expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import * as Data from '../../src/generated';
import { AdminCommands, ModeratorCommands, RoomCommands, SessionCommands } from '../../src';
import { CommandFailure } from '../../src/types/CommandFailure';
import { DEFAULT_COMMAND_TIMEOUT_MS } from '../../src/services/ProtobufService';
import { connectAndLogin, getMockResponse, getMockWebSocket, getWebClient } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import {
  findLastAdminCommand, findLastModeratorCommand, findLastSessionCommand, findLastRoomCommand,
} from '../../src/testing/command-capture';

const user = create(Data.ServerInfo_UserSchema, { name: 'alice' });
const notes = create(Data.Response_GetAdminNotesSchema, { notes: 'private notes' });
const ban = create(Data.ServerInfo_BanSchema, { adminId: '1', adminName: 'mod', banTime: 'now', banLength: '60' });
const warning = create(Data.ServerInfo_WarningSchema);
const warningList = create(Data.Response_WarnListSchema, { userName: 'alice', warning: ['reason'] });
const log = create(Data.ServerInfo_ChatMessageSchema);
const download = create(Data.Response_DeckDownloadSchema, { deck: '<deck/>' });
const cases = [
  {
    name: 'adjustMod', send: (id: [] | [string]) => AdminCommands.adjustMod('alice', false, true, undefined, ...id),
    capture: () => findLastAdminCommand(Data.Command_AdjustMod_ext),
    wire: create(Data.Command_AdjustModSchema, { userName: 'alice', shouldBeMod: false, shouldBeJudge: true }),
    reply: (cmdId: number) => buildResponse({ cmdId }),
    success: () => getMockResponse().admin.adjustMod, successArgs: ['alice', false, true, undefined],
    failure: () => getMockResponse().admin.commandFailed,
    failureArgs: (code: number, failure?: CommandFailure) => ['adjustMod', code, 'alice', failure],
  },
  {
    name: 'getAdminNotes', send: (id: [] | [string]) => ModeratorCommands.getAdminNotes('alice', ...id),
    capture: () => findLastModeratorCommand(Data.Command_GetAdminNotes_ext),
    wire: create(Data.Command_GetAdminNotesSchema, { userName: 'alice' }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_GetAdminNotes_ext, value: notes }),
    success: () => getMockResponse().moderator.getAdminNotes, successArgs: ['alice', 'private notes'],
    failure: () => getMockResponse().moderator.commandFailed,
    failureArgs: (code: number, failure?: CommandFailure) => ['getAdminNotes', code, 'alice', failure],
  },
  {
    name: 'banHistory', send: (id: [] | [string]) => ModeratorCommands.getBanHistory('alice', ...id),
    capture: () => findLastModeratorCommand(Data.Command_GetBanHistory_ext),
    wire: create(Data.Command_GetBanHistorySchema, { userName: 'alice' }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_BanHistory_ext, value: create(Data.Response_BanHistorySchema, { banList: [ban] }),
    }),
    success: () => getMockResponse().moderator.banHistory, successArgs: ['alice', [ban]],
    failure: () => getMockResponse().moderator.commandFailed,
    failureArgs: (code: number, failure?: CommandFailure) => ['banHistory', code, 'alice', failure],
  },
  {
    name: 'warnHistory', send: (id: [] | [string]) => ModeratorCommands.getWarnHistory('alice', ...id),
    capture: () => findLastModeratorCommand(Data.Command_GetWarnHistory_ext),
    wire: create(Data.Command_GetWarnHistorySchema, { userName: 'alice' }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_WarnHistory_ext, value: create(Data.Response_WarnHistorySchema, { warnList: [warning] }),
    }),
    success: () => getMockResponse().moderator.warnHistory, successArgs: ['alice', [warning]],
    failure: () => getMockResponse().moderator.commandFailed,
    failureArgs: (code: number, failure?: CommandFailure) => ['warnHistory', code, 'alice', failure],
  },
  {
    name: 'warnList', send: (id: [] | [string]) => ModeratorCommands.getWarnList('mod', 'alice', 'cid', ...id),
    capture: () => findLastModeratorCommand(Data.Command_GetWarnList_ext),
    wire: create(Data.Command_GetWarnListSchema, { modName: 'mod', userName: 'alice', userClientid: 'cid' }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_WarnList_ext, value: warningList }),
    success: () => getMockResponse().moderator.warnListOptions, successArgs: [[warningList]],
    failure: () => getMockResponse().moderator.commandFailed,
    failureArgs: (code: number, failure?: CommandFailure) => ['warnList', code, 'alice', failure],
  },
  {
    name: 'viewLogHistory user', send: (id: [] | [string]) => ModeratorCommands.viewLogHistory({ userName: 'alice', dateRange: 30 }, ...id),
    capture: () => findLastModeratorCommand(Data.Command_ViewLogHistory_ext),
    wire: create(Data.Command_ViewLogHistorySchema, { userName: 'alice', dateRange: 30 }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ViewLogHistory_ext, value: create(Data.Response_ViewLogHistorySchema, { logMessage: [log] }),
    }),
    success: () => getMockResponse().moderator.viewLogs, successArgs: [[log]],
    failure: () => getMockResponse().moderator.commandFailed,
    failureArgs: (code: number, failure?: CommandFailure) => ['viewLogHistory', code, 'alice', failure],
  },
  {
    name: 'viewLogHistory all', send: (id: [] | [string]) => ModeratorCommands.viewLogHistory({ dateRange: 30 }, ...id),
    capture: () => findLastModeratorCommand(Data.Command_ViewLogHistory_ext),
    wire: create(Data.Command_ViewLogHistorySchema, { dateRange: 30 }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ViewLogHistory_ext, value: create(Data.Response_ViewLogHistorySchema, { logMessage: [log] }),
    }),
    success: () => getMockResponse().moderator.viewLogs, successArgs: [[log]],
    failure: () => getMockResponse().moderator.commandFailed,
    failureArgs: (code: number, failure?: CommandFailure) => ['viewLogHistory', code, '', failure],
  },
  {
    name: 'getUserInfo', send: (id: [] | [string]) => SessionCommands.getUserInfo('alice', ...id),
    capture: () => findLastSessionCommand(Data.Command_GetUserInfo_ext),
    wire: create(Data.Command_GetUserInfoSchema, { userName: 'alice' }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_GetUserInfo_ext, value: create(Data.Response_GetUserInfoSchema, { userInfo: user }),
    }),
    success: () => getMockResponse().session.getUserInfo, successArgs: [user],
    failure: () => getMockResponse().session.getUserInfoFailed,
    failureArgs: (code: number, _failure?: CommandFailure) => ['alice', code],
  },
  {
    name: 'deckDownload', send: (id: [] | [string]) => SessionCommands.deckDownload(7, ...id),
    capture: () => findLastSessionCommand(Data.Command_DeckDownload_ext),
    wire: create(Data.Command_DeckDownloadSchema, { deckId: 7 }),
    reply: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_DeckDownload_ext, value: download }),
    success: () => getMockResponse().session.downloadServerDeck, successArgs: [7, download],
    failure: () => getMockResponse().session.deckDownloadFailed,
    failureArgs: (code: number, failure?: CommandFailure) => [7, code, failure],
  },
];

describe.each(cases)('$name outcomes', (testCase) => {
  describe.each([false, true])('correlation supplied: %s', (correlated) => {
    const id: [] | [string] = correlated ? ['request-7'] : [];

    it('sends the exact command and echoes success arguments', () => {
      connectAndLogin();
      testCase.send(id);
      const { value, cmdId } = testCase.capture();
      expect(value).toStrictEqual(testCase.wire);
      deliverMessage(buildResponseMessage(testCase.reply(cmdId)));
      expect(testCase.success()).toHaveBeenCalledExactlyOnceWith(...testCase.successArgs, ...id);
      expect(testCase.failure()).not.toHaveBeenCalled();
    });

    it.each(['rejected', 'timeout', 'disconnected', 'not-sent'] as const)('echoes exact %s failure arguments', (outcome) => {
      connectAndLogin();
      const socket = getMockWebSocket();
      const sentBefore = socket.send.mock.calls.length;
      if (outcome === 'not-sent') {
        socket.readyState = WebSocket.CLOSED;
      }
      testCase.send(id);
      if (outcome === 'not-sent') {
        expect(socket.send).toHaveBeenCalledTimes(sentBefore);
      } else {
        const { value, cmdId } = testCase.capture();
        expect(value).toStrictEqual(testCase.wire);
        if (outcome === 'rejected') {
          deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespContextError })));
        } else if (outcome === 'timeout') {
          vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
        } else {
          getWebClient().disconnect();
        }
      }
      const failure = outcome === 'rejected' ? undefined : outcome === 'timeout' ? CommandFailure.Timeout
        : outcome === 'disconnected' ? CommandFailure.Disconnected : CommandFailure.NotSent;
      const code = outcome === 'rejected' ? Data.Response_ResponseCode.RespContextError : Data.Response_ResponseCode.RespNotConnected;
      expect(testCase.failure()).toHaveBeenCalledExactlyOnceWith(...testCase.failureArgs(code, failure), ...id);
      expect(testCase.success()).not.toHaveBeenCalled();
    });
  });
});

it.each([
  Data.Response_ResponseCode.RespNotInRoom, Data.Response_ResponseCode.RespNameNotFound,
  Data.Response_ResponseCode.RespGameFull, Data.Response_ResponseCode.RespWrongPassword,
  Data.Response_ResponseCode.RespSpectatorsNotAllowed, Data.Response_ResponseCode.RespOnlyBuddies,
  Data.Response_ResponseCode.RespUserLevelTooLow, Data.Response_ResponseCode.RespInIgnoreList,
  Data.Response_ResponseCode.RespContextError, Data.Response_ResponseCode.RespInvalidCommand,
  Data.Response_ResponseCode.RespOk,
])('settles joinGame server response %s exactly', (responseCode) => {
  connectAndLogin();
  RoomCommands.joinGame(4, { gameId: 9, password: 'secret' });
  const { value, cmdId, roomId } = findLastRoomCommand(Data.Command_JoinGame_ext);
  expect(roomId).toBe(4);
  expect(value).toStrictEqual(create(Data.Command_JoinGameSchema, { gameId: 9, password: 'secret' }));
  expect(getMockResponse().room.setJoinGamePending).toHaveBeenCalledExactlyOnceWith(true);
  deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
  const room = getMockResponse().room;
  if (responseCode === Data.Response_ResponseCode.RespOk) {
    expect(room.joinedGame).toHaveBeenCalledExactlyOnceWith(4, 9);
  } else {
    expect(room.joinedGame).not.toHaveBeenCalled();
  }
  if ([Data.Response_ResponseCode.RespOk, Data.Response_ResponseCode.RespContextError,
    Data.Response_ResponseCode.RespInvalidCommand].includes(responseCode)) {
    expect(vi.mocked(room.setJoinGamePending).mock.calls).toEqual([[true], [false]]);
    expect(room.setJoinGameError).not.toHaveBeenCalled();
  } else {
    expect(room.setJoinGameError).toHaveBeenCalledExactlyOnceWith(responseCode, '');
    expect(vi.mocked(room.setJoinGamePending).mock.calls).toEqual([[true]]);
  }
});

it.each([Data.Response_ResponseCode.RespOk, Data.Response_ResponseCode.RespContextError])(
  'settles createGame response %s exactly', (responseCode) => {
    connectAndLogin();
    RoomCommands.createGame(4, { description: 'test game' });
    const { value, cmdId, roomId } = findLastRoomCommand(Data.Command_CreateGame_ext);
    expect(roomId).toBe(4);
    expect(value).toStrictEqual(create(Data.Command_CreateGameSchema, { description: 'test game' }));
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
    if (responseCode === Data.Response_ResponseCode.RespOk) {
      expect(getMockResponse().room.gameCreated).toHaveBeenCalledExactlyOnceWith(4);
      expect(getMockResponse().room.createGameFailed).not.toHaveBeenCalled();
    } else {
      expect(getMockResponse().room.createGameFailed).toHaveBeenCalledExactlyOnceWith(4, responseCode, undefined);
      expect(getMockResponse().room.gameCreated).not.toHaveBeenCalled();
    }
  },
);
