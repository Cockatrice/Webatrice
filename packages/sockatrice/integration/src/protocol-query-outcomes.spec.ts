import { create } from '@bufbuild/protobuf';
import type { GenExtension } from '@bufbuild/protobuf/codegenv2';
import type { Mock } from 'vitest';
import { AdminCommands, DeveloperCommands, ModeratorCommands, SessionCommands } from '../../src';
import * as Data from '../../src/generated';
import { connectAndLogin, getMockResponse } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import {
  findLastAdminCommand, findLastDeveloperCommand, findLastModeratorCommand, findLastSessionCommand,
} from '../../src/testing/command-capture';

interface QueryCase {
  name: string;
  command: string;
  send: () => void;
  capture: () => { cmdId: number; value: unknown };
  wire: object;
  forwardsFailureReason?: boolean;
  response?: (cmdId: number) => Data.Response;
  success: () => Mock;
  successArgs: unknown[];
  failure: () => Mock;
  target: string;
}

function responsePayload<V>(ext: GenExtension<Data.Response, V>, value: V) {
  return (cmdId: number) => buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespOk, ext, value });
}

const payloads = {
  selectedDeckShare: create(Data.Response_DeckShareCreateSchema, { token: 'share-token', itemCount: 1 }),
  folderShare: create(Data.Response_DeckShareCreateSchema, { token: 'folder-token', itemCount: 2 }),
  deckShareList: create(Data.Response_DeckShareListSchema, { name: 'Cube' }),
  deckShareDownload: create(Data.Response_DeckShareDownloadSchema, { deck: '<deck/>' }),
  deckShareListMine: create(Data.Response_DeckShareListMineSchema, {
    shares: [create(Data.ServerInfo_DeckShareSummarySchema, { id: 8, name: 'Cube' })]
  }),
  deckListOtherUser: create(Data.Response_DeckListSchema, { root: create(Data.ServerInfo_DeckStorage_FolderSchema, { name: 'Public' }) }),
  deckDownloadPublic: create(Data.Response_DeckDownloadSchema, { deck: '<public-deck/>' }),
  reportMyList: create(Data.Response_ReportMyListSchema, { reports: [create(Data.ServerInfo_ReportSchema, { reportId: 9 })] }),
  reportDetails: create(Data.Response_ReportDetailsSchema, {
    report: create(Data.ServerInfo_ReportSchema, { reportId: 9, reportedUserName: 'alice' })
  }),
  listCardArtRules: create(Data.Response_ListCardArtRulesSchema, {
    entries: [create(Data.Response_CardArtRuleEntrySchema, { cardName: 'Island', mode: 'DENY' })]
  }),
  getUserSessions: create(Data.Response_UserSessionsSchema, {
    sessions: [create(Data.ServerInfo_UserSessionSchema, { userName: 'alice', connectionType: 'websocket' })]
  }),
  getUserAlts: create(Data.Response_UserAltsSchema, { alts: [create(Data.ServerInfo_UserAltSchema, { userName: 'alt', banCount: 2 })] }),
  getModeratorLastLogins: create(Data.Response_ModeratorLastLoginsSchema, {
    logins: [create(Data.ServerInfo_ModeratorLoginSchema, { userName: 'mod', lastLogin: 123n })]
  }),
  canonicalAvatarUser: create(Data.Response_RemoveUserAvatarSchema, { userName: 'Alice' }),
  missingAvatarUser: create(Data.Response_RemoveUserAvatarSchema, { userName: '' }),
  reportList: create(Data.Response_ReportListSchema, { reports: [create(Data.ServerInfo_ReportSchema, { reportId: 9 })], totalCount: 31 }),
  reportUserInfo: create(Data.Response_ReportUserInfoSchema, { userName: 'alice', totalReports: 3 }),
  reportStats: create(Data.Response_ReportStatsSchema, { totalReports: 9, totalPending: 2 }),
  replayDownloadByGameId: create(Data.Response_ReplayDownloadByGameIdSchema, { replayId: 5, replayData: new Uint8Array([1, 2]) }),
  getServerStats: create(Data.Response_GetServerStatsSchema, { usersCount: 12n, gamesCount: 3n }),
  namedUserLogs: create(Data.Response_ViewLogHistorySchema, {
    logMessage: [create(Data.ServerInfo_ChatMessageSchema, { senderName: 'alice', message: 'hello' })]
  }),
  unfilteredLogs: create(Data.Response_ViewLogHistorySchema, {
    logMessage: [create(Data.ServerInfo_ChatMessageSchema, { senderName: 'alice', message: 'hello' })]
  }),
};

const cases: QueryCase[] = [
  {
    name: 'deckShareCreate for a deck selection', command: 'deckShareCreate', forwardsFailureReason: true,
    send: () => SessionCommands.deckShareCreate({ items: [{ deckId: 7 }] }),
    capture: () => findLastSessionCommand(Data.Command_DeckShareCreate_ext),
    wire: { items: [create(Data.DeckShareItemSchema, { deckId: 7 })] },
    response: responsePayload(Data.Response_DeckShareCreate_ext, payloads.selectedDeckShare),
    success: () => getMockResponse().session.deckShareCreated,
    successArgs: [payloads.selectedDeckShare],
    failure: () => getMockResponse().session.commandFailed, target: '',
  },
  {
    name: 'deckShareCreate for a folder', command: 'deckShareCreate', forwardsFailureReason: true,
    send: () => SessionCommands.deckShareCreate({ folderPath: 'Cube' }),
    capture: () => findLastSessionCommand(Data.Command_DeckShareCreate_ext),
    wire: { folderPath: 'Cube', items: [] },
    response: responsePayload(Data.Response_DeckShareCreate_ext, payloads.folderShare),
    success: () => getMockResponse().session.deckShareCreated,
    successArgs: [payloads.folderShare],
    failure: () => getMockResponse().session.commandFailed, target: 'Cube',
  },
  {
    name: 'deckShareList by token', command: 'deckShareList', forwardsFailureReason: true,
    send: () => SessionCommands.deckShareList('token'),
    capture: () => findLastSessionCommand(Data.Command_DeckShareList_ext),
    wire: { token: 'token' },
    response: responsePayload(Data.Response_DeckShareList_ext, payloads.deckShareList),
    success: () => getMockResponse().session.deckShareListed,
    successArgs: ['token', payloads.deckShareList],
    failure: () => getMockResponse().session.commandFailed, target: 'token',
  },
  {
    name: 'deckShareDownload for a shared item', command: 'deckShareDownload', forwardsFailureReason: true,
    send: () => SessionCommands.deckShareDownload('token', 7),
    capture: () => findLastSessionCommand(Data.Command_DeckShareDownload_ext),
    wire: { token: 'token', itemId: 7 },
    response: responsePayload(Data.Response_DeckShareDownload_ext, payloads.deckShareDownload),
    success: () => getMockResponse().session.deckShareDownloaded,
    successArgs: ['token', 7, '<deck/>'],
    failure: () => getMockResponse().session.commandFailed, target: 'token',
  },
  {
    name: 'deckShareListMine returns share summaries', command: 'deckShareListMine', forwardsFailureReason: true,
    send: () => SessionCommands.deckShareListMine(),
    capture: () => findLastSessionCommand(Data.Command_DeckShareListMine_ext),
    wire: {},
    response: responsePayload(Data.Response_DeckShareListMine_ext, payloads.deckShareListMine),
    success: () => getMockResponse().session.deckSharesMine,
    successArgs: [payloads.deckShareListMine.shares],
    failure: () => getMockResponse().session.commandFailed, target: '',
  },
  {
    name: 'deckShareRemove by share ID', command: 'deckShareRemove', forwardsFailureReason: true,
    send: () => SessionCommands.deckShareRemove(8),
    capture: () => findLastSessionCommand(Data.Command_DeckShareRemove_ext),
    wire: { shareId: 8 },
    success: () => getMockResponse().session.deckShareRemoved,
    successArgs: [8],
    failure: () => getMockResponse().session.commandFailed, target: '8',
  },
  {
    name: 'deckListOtherUser returns a public folder', command: 'deckListOtherUser', forwardsFailureReason: true,
    send: () => SessionCommands.deckListOtherUser('alice'),
    capture: () => findLastSessionCommand(Data.Command_DeckListOtherUser_ext),
    wire: { userName: 'alice' },
    response: responsePayload(Data.Response_DeckList_ext, payloads.deckListOtherUser),
    success: () => getMockResponse().session.otherUserDecks,
    successArgs: ['alice', payloads.deckListOtherUser],
    failure: () => getMockResponse().session.commandFailed, target: 'alice',
  },
  {
    name: 'deckSetVisibility for deck ID zero', command: 'deckSetVisibility', forwardsFailureReason: true,
    send: () => SessionCommands.deckSetVisibility({ deckId: 0, isPublic: false }),
    capture: () => findLastSessionCommand(Data.Command_DeckSetVisibility_ext),
    wire: { deckId: 0, isPublic: false },
    success: () => getMockResponse().session.deckVisibilityChanged,
    successArgs: [{ deckId: 0, isPublic: false }],
    failure: () => getMockResponse().session.commandFailed, target: '0',
  },
  {
    name: 'deckSetVisibility for a folder', command: 'deckSetVisibility', forwardsFailureReason: true,
    send: () => SessionCommands.deckSetVisibility({ folderPath: 'Cube', isPublic: true }),
    capture: () => findLastSessionCommand(Data.Command_DeckSetVisibility_ext),
    wire: { folderPath: 'Cube', isPublic: true },
    success: () => getMockResponse().session.deckVisibilityChanged,
    successArgs: [{ folderPath: 'Cube', isPublic: true }],
    failure: () => getMockResponse().session.commandFailed, target: 'Cube',
  },
  {
    name: 'deckSetVisibility without a target', command: 'deckSetVisibility', forwardsFailureReason: true,
    send: () => SessionCommands.deckSetVisibility({ isPublic: false }),
    capture: () => findLastSessionCommand(Data.Command_DeckSetVisibility_ext),
    wire: { isPublic: false },
    success: () => getMockResponse().session.deckVisibilityChanged,
    successArgs: [{ isPublic: false }],
    failure: () => getMockResponse().session.commandFailed, target: '',
  },
  {
    name: 'deckDownloadPublic returns deck text', command: 'deckDownloadPublic', forwardsFailureReason: true,
    send: () => SessionCommands.deckDownloadPublic(7),
    capture: () => findLastSessionCommand(Data.Command_DeckDownloadPublic_ext),
    wire: { deckId: 7 },
    response: responsePayload(Data.Response_DeckDownload_ext, payloads.deckDownloadPublic),
    success: () => getMockResponse().session.publicDeckDownloaded,
    successArgs: [7, '<public-deck/>'],
    failure: () => getMockResponse().session.commandFailed, target: '7',
  },
  {
    name: 'reportMyList returns reports', command: 'reportMyList', forwardsFailureReason: true,
    send: () => SessionCommands.reportMyList(),
    capture: () => findLastSessionCommand(Data.Command_ReportMyList_ext),
    wire: {},
    response: responsePayload(Data.Response_ReportMyList_ext, payloads.reportMyList),
    success: () => getMockResponse().session.reportMyList,
    successArgs: [payloads.reportMyList.reports],
    failure: () => getMockResponse().session.commandFailed, target: '',
  },
  {
    name: 'reportDetails returns the requested report', command: 'reportDetails', forwardsFailureReason: true,
    send: () => SessionCommands.reportDetails(9),
    capture: () => findLastSessionCommand(Data.Command_ReportDetails_ext),
    wire: { reportId: 9 },
    response: responsePayload(Data.Response_ReportDetails_ext, payloads.reportDetails),
    success: () => getMockResponse().session.reportDetails,
    successArgs: [payloads.reportDetails.report],
    failure: () => getMockResponse().session.commandFailed, target: '9',
  },
  {
    name: 'listCardArtRules returns entries', command: 'listCardArtRules', forwardsFailureReason: true,
    send: () => ModeratorCommands.listCardArtRules(),
    capture: () => findLastModeratorCommand(Data.Command_ListCardArtRules_ext),
    wire: {},
    response: responsePayload(Data.Response_ListCardArtRules_ext, payloads.listCardArtRules),
    success: () => getMockResponse().moderator.cardArtRules,
    successArgs: [payloads.listCardArtRules.entries],
    failure: () => getMockResponse().moderator.commandFailed, target: '',
  },
  {
    name: 'addCardArtRule defaults the reason', command: 'addCardArtRule', forwardsFailureReason: true,
    send: () => ModeratorCommands.addCardArtRule('Island', 'provider', 'DENY'),
    capture: () => findLastModeratorCommand(Data.Command_AddCardArtRule_ext),
    wire: { cardName: 'Island', cardProviderId: 'provider', mode: 'DENY', reason: '' },
    success: () => getMockResponse().moderator.cardArtRuleAdded,
    successArgs: ['Island', 'provider', 'DENY', ''],
    failure: () => getMockResponse().moderator.commandFailed, target: 'Island',
  },
  {
    name: 'removeCardArtRule identifies the card and provider', command: 'removeCardArtRule', forwardsFailureReason: true,
    send: () => ModeratorCommands.removeCardArtRule('Island', 'provider'),
    capture: () => findLastModeratorCommand(Data.Command_RemoveCardArtRule_ext),
    wire: { cardName: 'Island', cardProviderId: 'provider' },
    success: () => getMockResponse().moderator.cardArtRuleRemoved,
    successArgs: ['Island', 'provider'],
    failure: () => getMockResponse().moderator.commandFailed, target: 'Island',
  },
  {
    name: 'getUserSessions returns sessions for the named user', command: 'getUserSessions', forwardsFailureReason: true,
    send: () => ModeratorCommands.getUserSessions('alice', 20),
    capture: () => findLastModeratorCommand(Data.Command_GetUserSessions_ext),
    wire: { userName: 'alice', limit: 20 },
    response: responsePayload(Data.Response_UserSessions_ext, payloads.getUserSessions),
    success: () => getMockResponse().moderator.userSessions,
    successArgs: ['alice', payloads.getUserSessions.sessions],
    failure: () => getMockResponse().moderator.commandFailed, target: 'alice',
  },
  {
    name: 'getUserAlts returns alternate accounts', command: 'getUserAlts', forwardsFailureReason: true,
    send: () => ModeratorCommands.getUserAlts('alice'),
    capture: () => findLastModeratorCommand(Data.Command_GetUserAlts_ext),
    wire: { userName: 'alice' },
    response: responsePayload(Data.Response_UserAlts_ext, payloads.getUserAlts),
    success: () => getMockResponse().moderator.userAlts,
    successArgs: ['alice', payloads.getUserAlts.alts],
    failure: () => getMockResponse().moderator.commandFailed, target: 'alice',
  },
  {
    name: 'getModeratorLastLogins returns login timestamps', command: 'getModeratorLastLogins', forwardsFailureReason: true,
    send: () => ModeratorCommands.getModeratorLastLogins(),
    capture: () => findLastModeratorCommand(Data.Command_GetModeratorLastLogins_ext),
    wire: {},
    response: responsePayload(Data.Response_ModeratorLastLogins_ext, payloads.getModeratorLastLogins),
    success: () => getMockResponse().moderator.moderatorLastLogins,
    successArgs: [payloads.getModeratorLastLogins.logins],
    failure: () => getMockResponse().moderator.commandFailed, target: '',
  },
  {
    name: 'removeUserAvatar uses the canonical name', command: 'removeUserAvatar', forwardsFailureReason: true,
    send: () => ModeratorCommands.removeUserAvatar('alice'),
    capture: () => findLastModeratorCommand(Data.Command_RemoveUserAvatar_ext),
    wire: { userName: 'alice' },
    response: responsePayload(Data.Response_RemoveUserAvatar_ext, payloads.canonicalAvatarUser),
    success: () => getMockResponse().moderator.userAvatarRemoved,
    successArgs: ['Alice'],
    failure: () => getMockResponse().moderator.commandFailed, target: 'alice',
  },
  {
    name: 'removeUserAvatar falls back to the requested name', command: 'removeUserAvatar', forwardsFailureReason: true,
    send: () => ModeratorCommands.removeUserAvatar('alice'),
    capture: () => findLastModeratorCommand(Data.Command_RemoveUserAvatar_ext),
    wire: { userName: 'alice' },
    response: responsePayload(Data.Response_RemoveUserAvatar_ext, payloads.missingAvatarUser),
    success: () => getMockResponse().moderator.userAvatarRemoved,
    successArgs: ['alice'],
    failure: () => getMockResponse().moderator.commandFailed, target: 'alice',
  },
  {
    name: 'reportAssign identifies the assigned report', command: 'reportAssign', forwardsFailureReason: true,
    send: () => ModeratorCommands.reportAssign(9),
    capture: () => findLastModeratorCommand(Data.Command_ReportAssign_ext),
    wire: { reportId: 9 },
    success: () => getMockResponse().moderator.reportAssigned,
    successArgs: [9],
    failure: () => getMockResponse().moderator.commandFailed, target: '9',
  },
  {
    name: 'reportResolve defaults dismissal to false', command: 'reportResolve', forwardsFailureReason: true,
    send: () => ModeratorCommands.reportResolve(9),
    capture: () => findLastModeratorCommand(Data.Command_ReportResolve_ext),
    wire: { reportId: 9, dismissed: false },
    success: () => getMockResponse().moderator.reportResolved,
    successArgs: [9, false],
    failure: () => getMockResponse().moderator.commandFailed, target: '9',
  },
  {
    name: 'reportResolve explicitly dismisses a report', command: 'reportResolve', forwardsFailureReason: true,
    send: () => ModeratorCommands.reportResolve(9, 'dismissed', true),
    capture: () => findLastModeratorCommand(Data.Command_ReportResolve_ext),
    wire: { reportId: 9, resolutionNote: 'dismissed', dismissed: true },
    success: () => getMockResponse().moderator.reportResolved,
    successArgs: [9, true],
    failure: () => getMockResponse().moderator.commandFailed, target: '9',
  },
  {
    name: 'reportList returns a page and total count', command: 'reportList', forwardsFailureReason: true,
    send: () => ModeratorCommands.reportList(true, 0, 25),
    capture: () => findLastModeratorCommand(Data.Command_ReportList_ext),
    wire: { unresolvedOnly: true, offset: 0, limit: 25 },
    response: responsePayload(Data.Response_ReportList_ext, payloads.reportList),
    success: () => getMockResponse().moderator.reportList,
    successArgs: [payloads.reportList.reports, 31],
    failure: () => getMockResponse().moderator.commandFailed, target: '',
  },
  {
    name: 'reportUserInfo returns the named account', command: 'reportUserInfo', forwardsFailureReason: true,
    send: () => ModeratorCommands.reportUserInfo('alice'),
    capture: () => findLastModeratorCommand(Data.Command_ReportUserInfo_ext),
    wire: { userName: 'alice' },
    response: responsePayload(Data.Response_ReportUserInfo_ext, payloads.reportUserInfo),
    success: () => getMockResponse().moderator.reportUserInfo,
    successArgs: [payloads.reportUserInfo],
    failure: () => getMockResponse().moderator.commandFailed, target: 'alice',
  },
  {
    name: 'reportStats returns queue totals', command: 'reportStats', forwardsFailureReason: true,
    send: () => ModeratorCommands.reportStats(),
    capture: () => findLastModeratorCommand(Data.Command_ReportStats_ext),
    wire: {},
    response: responsePayload(Data.Response_ReportStats_ext, payloads.reportStats),
    success: () => getMockResponse().moderator.reportStats,
    successArgs: [payloads.reportStats],
    failure: () => getMockResponse().moderator.commandFailed, target: '',
  },
  {
    name: 'replayDownloadByGameId returns replay bytes', command: 'replayDownloadByGameId', forwardsFailureReason: true,
    send: () => ModeratorCommands.replayDownloadByGameId(77),
    capture: () => findLastModeratorCommand(Data.Command_ReplayDownloadByGameId_ext),
    wire: { gameId: 77 },
    response: responsePayload(Data.Response_ReplayDownloadByGameId_ext, payloads.replayDownloadByGameId),
    success: () => getMockResponse().moderator.replayDownloadedByGameId,
    successArgs: [77, payloads.replayDownloadByGameId],
    failure: () => getMockResponse().moderator.commandFailed, target: '77',
  },
  {
    name: 'getServerStats returns a developer snapshot', command: 'getServerStats', forwardsFailureReason: true,
    send: () => DeveloperCommands.getServerStats(),
    capture: () => findLastDeveloperCommand(Data.Command_GetServerStats_ext),
    wire: {},
    response: responsePayload(Data.Response_GetServerStats_ext, payloads.getServerStats),
    success: () => getMockResponse().developer.serverStats,
    successArgs: [payloads.getServerStats],
    failure: () => getMockResponse().developer.commandFailed, target: '',
  },
  {
    name: 'viewLogHistory for a named user', command: 'viewLogHistory', forwardsFailureReason: true,
    send: () => DeveloperCommands.viewLogHistory({ userName: 'alice', dateRange: 1 }),
    capture: () => findLastDeveloperCommand(Data.Command_ViewLogHistory_dev_ext),
    wire: { userName: 'alice', dateRange: 1, logLocation: [] },
    response: responsePayload(Data.Response_ViewLogHistory_ext, payloads.namedUserLogs),
    success: () => getMockResponse().moderator.viewLogs,
    successArgs: [payloads.namedUserLogs.logMessage],
    failure: () => getMockResponse().moderator.commandFailed, target: 'alice',
  },
  {
    name: 'viewLogHistory without a user filter', command: 'viewLogHistory', forwardsFailureReason: true,
    send: () => DeveloperCommands.viewLogHistory({ dateRange: 1 }),
    capture: () => findLastDeveloperCommand(Data.Command_ViewLogHistory_dev_ext),
    wire: { dateRange: 1, logLocation: [] },
    response: responsePayload(Data.Response_ViewLogHistory_ext, payloads.unfilteredLogs),
    success: () => getMockResponse().moderator.viewLogs,
    successArgs: [payloads.unfilteredLogs.logMessage],
    failure: () => getMockResponse().moderator.commandFailed, target: '',
  },
];

describe('protocol query outcomes', () => {
  describe.each(cases)('$name', (testCase) => {
    function send() {
      testCase.send();
      const { cmdId, value } = testCase.capture();
      expect({ ...value }).toEqual({ $typeName: value.$typeName, ...testCase.wire });
      return cmdId;
    }

    it('delivers the correlated success with exact arguments', () => {
      connectAndLogin();
      const cmdId = send();
      const response = testCase.response?.(cmdId) ?? buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespOk });
      deliverMessage(buildResponseMessage(response));
      expect(testCase.success()).toHaveBeenCalledExactlyOnceWith(...testCase.successArgs);
      expect(testCase.failure()).not.toHaveBeenCalled();
    });

    it('reports the correlated refusal with its exact target', () => {
      connectAndLogin();
      const cmdId = send();
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId, responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed,
      })));
      expect(testCase.failure()).toHaveBeenCalledExactlyOnceWith(
        testCase.command, Data.Response_ResponseCode.RespFunctionNotAllowed, testCase.target,
        ...(testCase.forwardsFailureReason ? [undefined] : []),
      );
      expect(testCase.success()).not.toHaveBeenCalled();
    });
  });

  it.each([['Alice', 'Alice'], ['', ' alice ']])('resetUserPassword uses echoed name %j with a one-time password', (echo, expected) => {
    connectAndLogin();
    const onReset = vi.fn();
    const onFailure = vi.fn();
    AdminCommands.resetUserPassword(' alice ', onReset, onFailure);
    const { cmdId, value } = findLastAdminCommand(Data.Command_ResetUserPassword_ext);
    expect(value.userName).toBe(' alice ');
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ResetUserPassword_ext,
      value: create(Data.Response_ResetUserPasswordSchema, { userName: echo, temporaryPassword: 'one-time' }),
    })));
    expect(onReset).toHaveBeenCalledExactlyOnceWith(expected, 'one-time');
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('reportDetails drops a successful response without a report', () => {
    connectAndLogin();
    SessionCommands.reportDetails(9);
    const { cmdId, value } = findLastSessionCommand(Data.Command_ReportDetails_ext);
    expect(value.reportId).toBe(9);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReportDetails_ext,
      value: create(Data.Response_ReportDetailsSchema),
    })));
    expect(getMockResponse().session.reportDetails).not.toHaveBeenCalled();
    expect(getMockResponse().session.commandFailed).not.toHaveBeenCalled();
  });
});
