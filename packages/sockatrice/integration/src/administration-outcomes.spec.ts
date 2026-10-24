import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';
import * as Data from '../../src/generated';
import { AdminCommands, DeveloperCommands, ModeratorCommands } from '../../src';
import { CommandFailure } from '../../src/types/CommandFailure';
import { connectAndLogin, getMockResponse, getMockWebSocket, getWebClient } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import {
  findLastAdminCommand,
  findLastDeveloperCommand,
  findLastModeratorCommand,
} from '../../src/testing/command-capture';

const cases = [
  {
    name: 'reloadConfig', target: '',
    send: () => AdminCommands.reloadConfig(),
    capture: () => findLastAdminCommand(Data.Command_ReloadConfig_ext),
    expected: { $typeName: Data.Command_ReloadConfigSchema.typeName, ...{} },
    success: () => getMockResponse().admin.reloadConfig,
    failure: () => getMockResponse().admin.commandFailed,
    successArgs: () => [],
    answer: (cmdId: number) => buildResponse({ cmdId }),
  },
  {
    name: 'updateServerMessage', target: '',
    send: () => AdminCommands.updateServerMessage(),
    capture: () => findLastAdminCommand(Data.Command_UpdateServerMessage_ext),
    expected: { $typeName: Data.Command_UpdateServerMessageSchema.typeName, ...{} },
    success: () => getMockResponse().admin.updateServerMessage,
    failure: () => getMockResponse().admin.commandFailed,
    successArgs: () => [],
    answer: (cmdId: number) => buildResponse({ cmdId }),
  },
  {
    name: 'shutdownServer', target: '',
    send: () => AdminCommands.shutdownServer('maintenance', 5),
    capture: () => findLastAdminCommand(Data.Command_ShutdownServer_ext),
    expected: { $typeName: Data.Command_ShutdownServerSchema.typeName, ...{ reason: 'maintenance', minutes: 5 } },
    success: () => getMockResponse().admin.shutdownServer,
    failure: () => getMockResponse().admin.commandFailed,
    successArgs: () => [],
    answer: (cmdId: number) => buildResponse({ cmdId }),
  },
  {
    name: 'getUserAlts', target: 'alice',
    send: () => ModeratorCommands.getUserAlts('alice'),
    capture: () => findLastModeratorCommand(Data.Command_GetUserAlts_ext),
    expected: { $typeName: Data.Command_GetUserAltsSchema.typeName, ...{ userName: 'alice' } },
    success: () => getMockResponse().moderator.userAlts,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => ['alice', [create(Data.ServerInfo_UserAltSchema, { userName: 'alt', email: 'alt@example.test' })]],
    answer: (cmdId: number) => buildResponse({ cmdId, ext: Data.Response_UserAlts_ext,
      value: create(Data.Response_UserAltsSchema, {
        alts: [create(Data.ServerInfo_UserAltSchema, { userName: 'alt', email: 'alt@example.test' })]
      }),
    }),
  },
  {
    name: 'getUserSessions', target: 'alice',
    send: () => ModeratorCommands.getUserSessions('alice', 7),
    capture: () => findLastModeratorCommand(Data.Command_GetUserSessions_ext),
    expected: { $typeName: Data.Command_GetUserSessionsSchema.typeName, ...{ userName: 'alice', limit: 7 } },
    success: () => getMockResponse().moderator.userSessions,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => ['alice', [create(Data.ServerInfo_UserSessionSchema, { ipAddress: '192.0.2.7' })]],
    answer: (cmdId: number) => buildResponse({ cmdId, ext: Data.Response_UserSessions_ext,
      value: create(Data.Response_UserSessionsSchema, {
        sessions: [create(Data.ServerInfo_UserSessionSchema, { ipAddress: '192.0.2.7' })]
      }),
    }),
  },
  {
    name: 'reportUserInfo', target: 'alice',
    send: () => ModeratorCommands.reportUserInfo('alice'),
    capture: () => findLastModeratorCommand(Data.Command_ReportUserInfo_ext),
    expected: { $typeName: Data.Command_ReportUserInfoSchema.typeName, ...{ userName: 'alice' } },
    success: () => getMockResponse().moderator.reportUserInfo,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => [create(Data.Response_ReportUserInfoSchema, { userName: 'alice', adminNotes: 'private' })],
    answer: (cmdId: number) => buildResponse({ cmdId, ext: Data.Response_ReportUserInfo_ext,
      value: create(Data.Response_ReportUserInfoSchema, { userName: 'alice', adminNotes: 'private' }),
    }),
  },
  {
    name: 'getModeratorLastLogins', target: '',
    send: () => ModeratorCommands.getModeratorLastLogins(),
    capture: () => findLastModeratorCommand(Data.Command_GetModeratorLastLogins_ext),
    expected: { $typeName: Data.Command_GetModeratorLastLoginsSchema.typeName, ...{} },
    success: () => getMockResponse().moderator.moderatorLastLogins,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => [[create(Data.ServerInfo_ModeratorLoginSchema, { userName: 'mod', lastLogin: 123n })]],
    answer: (cmdId: number) => buildResponse({ cmdId, ext: Data.Response_ModeratorLastLogins_ext,
      value: create(Data.Response_ModeratorLastLoginsSchema, {
        logins: [create(Data.ServerInfo_ModeratorLoginSchema, { userName: 'mod', lastLogin: 123n })]
      }),
    }),
  },
  {
    name: 'listCardArtRules', target: '',
    send: () => ModeratorCommands.listCardArtRules(),
    capture: () => findLastModeratorCommand(Data.Command_ListCardArtRules_ext),
    expected: { $typeName: Data.Command_ListCardArtRulesSchema.typeName, ...{} },
    success: () => getMockResponse().moderator.cardArtRules,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => [[create(Data.Response_CardArtRuleEntrySchema, { cardName: 'Island', cardProviderId: 'p1', mode: 'DENY' })]],
    answer: (cmdId: number) => buildResponse({ cmdId, ext: Data.Response_ListCardArtRules_ext,
      value: create(Data.Response_ListCardArtRulesSchema, {
        entries: [create(Data.Response_CardArtRuleEntrySchema, { cardName: 'Island', cardProviderId: 'p1', mode: 'DENY' })]
      }),
    }),
  },
  {
    name: 'addCardArtRule', target: 'Island',
    send: () => ModeratorCommands.addCardArtRule('Island', 'p1', 'DENY', 'incorrect art'),
    capture: () => findLastModeratorCommand(Data.Command_AddCardArtRule_ext),
    expected: { $typeName: Data.Command_AddCardArtRuleSchema.typeName,
      ...{ cardName: 'Island', cardProviderId: 'p1', mode: 'DENY', reason: 'incorrect art' } },
    success: () => getMockResponse().moderator.cardArtRuleAdded,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => ['Island', 'p1', 'DENY', 'incorrect art'],
    answer: (cmdId: number) => buildResponse({ cmdId }),
  },
  {
    name: 'removeCardArtRule', target: 'Island',
    send: () => ModeratorCommands.removeCardArtRule('Island', 'p1'),
    capture: () => findLastModeratorCommand(Data.Command_RemoveCardArtRule_ext),
    expected: { $typeName: Data.Command_RemoveCardArtRuleSchema.typeName, ...{ cardName: 'Island', cardProviderId: 'p1' } },
    success: () => getMockResponse().moderator.cardArtRuleRemoved,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => ['Island', 'p1'],
    answer: (cmdId: number) => buildResponse({ cmdId }),
  },
  {
    name: 'removeUserAvatar', target: 'ALICE',
    send: () => ModeratorCommands.removeUserAvatar('ALICE'),
    capture: () => findLastModeratorCommand(Data.Command_RemoveUserAvatar_ext),
    expected: { $typeName: Data.Command_RemoveUserAvatarSchema.typeName, ...{ userName: 'ALICE' } },
    success: () => getMockResponse().moderator.userAvatarRemoved,
    failure: () => getMockResponse().moderator.commandFailed,
    successArgs: () => ['alice'],
    answer: (cmdId: number) => buildResponse({ cmdId, ext: Data.Response_RemoveUserAvatar_ext,
      value: create(Data.Response_RemoveUserAvatarSchema, { userName: 'alice' }),
    }),
  },
  {
    name: 'getServerStats', target: '',
    send: () => DeveloperCommands.getServerStats(),
    capture: () => findLastDeveloperCommand(Data.Command_GetServerStats_ext),
    expected: { $typeName: Data.Command_GetServerStatsSchema.typeName, ...{} },
    success: () => getMockResponse().developer.serverStats,
    failure: () => getMockResponse().developer.commandFailed,
    successArgs: () => [create(Data.Response_GetServerStatsSchema, { usersCount: 7n, gamesCount: 3n })],
    answer: (cmdId: number) => buildResponse({ cmdId, ext: Data.Response_GetServerStats_ext,
      value: create(Data.Response_GetServerStatsSchema, { usersCount: 7n, gamesCount: 3n }),
    }),
  },
];

describe.each(cases)('$name administration outcomes', (testCase) => {
  it('sends the exact command and delivers the complete success callback', () => {
    connectAndLogin();
    getMockWebSocket().send.mockClear();
    testCase.send();
    expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
    const { cmdId, value } = testCase.capture();
    expect({ ...value }).toEqual(testCase.expected);
    deliverMessage(buildResponseMessage(testCase.answer(cmdId)));
    expect(testCase.success().mock.calls).toEqual([testCase.successArgs()]);
    expect(testCase.failure().mock.calls).toEqual([]);
    expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
  });

  it.each(['rejected', 'disconnected'] as const)('reports %s with the exact target and reason', (outcome) => {
    connectAndLogin();
    getMockWebSocket().send.mockClear();
    testCase.send();
    expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
    const { cmdId, value } = testCase.capture();
    expect({ ...value }).toEqual(testCase.expected);
    if (outcome === 'rejected') {
      deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespAccessDenied })));
    } else {
      getWebClient().disconnect();
    }
    const code = outcome === 'rejected' ? Data.Response_ResponseCode.RespAccessDenied : Data.Response_ResponseCode.RespNotConnected;
    const failure = outcome === 'rejected' ? undefined : CommandFailure.Disconnected;
    expect(testCase.failure().mock.calls).toEqual([[testCase.name, code, testCase.target, failure]]);
    expect(testCase.success().mock.calls).toEqual([]);
    expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
  });
});

it.each(['canonical', ''] as const)('password resets resolve the returned name %s only to the caller', (userName) => {
  connectAndLogin();
  getMockWebSocket().send.mockClear();
  const onReset = vi.fn();
  const onFailure = vi.fn();
  AdminCommands.resetUserPassword('requested', onReset, onFailure);
  const { cmdId, value } = findLastAdminCommand(Data.Command_ResetUserPassword_ext);
  expect({ ...value }).toEqual({ $typeName: Data.Command_ResetUserPasswordSchema.typeName, userName: 'requested' });
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId, ext: Data.Response_ResetUserPassword_ext,
    value: create(Data.Response_ResetUserPasswordSchema, { userName, temporaryPassword: 'temporary-secret' }),
  })));
  expect(onReset.mock.calls).toEqual([[userName === '' ? 'requested' : 'canonical', 'temporary-secret']]);
  expect(onFailure.mock.calls).toEqual([]);
  expect(getMockResponse().admin.commandFailed.mock.calls).toEqual([]);
  expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
});

it.each(['rejected', 'disconnected'] as const)('password reset reports %s only to its caller', (outcome) => {
  connectAndLogin();
  getMockWebSocket().send.mockClear();
  const onReset = vi.fn();
  const onFailure = vi.fn();
  AdminCommands.resetUserPassword('requested', onReset, onFailure);
  const { cmdId, value } = findLastAdminCommand(Data.Command_ResetUserPassword_ext);
  expect({ ...value }).toEqual({ $typeName: Data.Command_ResetUserPasswordSchema.typeName, userName: 'requested' });
  if (outcome === 'rejected') {
    deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespAccessDenied })));
  } else {
    getWebClient().disconnect();
  }
  expect(onFailure.mock.calls).toEqual(outcome === 'rejected'
    ? [[Data.Response_ResponseCode.RespAccessDenied, undefined]]
    : [[Data.Response_ResponseCode.RespNotConnected, CommandFailure.Disconnected]]);
  expect(onReset.mock.calls).toEqual([]);
  expect(getMockResponse().admin.commandFailed.mock.calls).toEqual([]);
  expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
});

it('uses the requested account when the avatar removal response omits its name', () => {
  connectAndLogin();
  getMockWebSocket().send.mockClear();
  ModeratorCommands.removeUserAvatar('requested');
  const { cmdId, value } = findLastModeratorCommand(Data.Command_RemoveUserAvatar_ext);
  expect({ ...value }).toEqual({ $typeName: Data.Command_RemoveUserAvatarSchema.typeName, userName: 'requested' });
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId, ext: Data.Response_RemoveUserAvatar_ext, value: create(Data.Response_RemoveUserAvatarSchema),
  })));
  expect(getMockResponse().moderator.userAvatarRemoved.mock.calls).toEqual([['requested']]);
  expect(getMockResponse().moderator.commandFailed.mock.calls).toEqual([]);
  expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
});

it('sends and acknowledges an empty reason when adding a card-art rule without one', () => {
  connectAndLogin();
  getMockWebSocket().send.mockClear();
  ModeratorCommands.addCardArtRule('Forest', 'p2', 'ALLOW');
  const { cmdId, value } = findLastModeratorCommand(Data.Command_AddCardArtRule_ext);
  expect({ ...value }).toEqual({
    $typeName: Data.Command_AddCardArtRuleSchema.typeName, cardName: 'Forest', cardProviderId: 'p2', mode: 'ALLOW', reason: '',
  });
  deliverMessage(buildResponseMessage(buildResponse({ cmdId })));
  expect(getMockResponse().moderator.cardArtRuleAdded.mock.calls).toEqual([['Forest', 'p2', 'ALLOW', '']]);
  expect(getMockResponse().moderator.commandFailed.mock.calls).toEqual([]);
  expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
});
