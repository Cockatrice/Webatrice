vi.mock('../../WebClient');

import { create } from '@bufbuild/protobuf';
import type { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import type { RequestId } from '../../types/RequestId';
import {
  Command_ViewLogHistorySchema, Response_BanHistorySchema, Response_GetAdminNotesSchema, Response_GetUserInfoSchema,
  Response_ViewLogHistorySchema, Response_WarnHistorySchema, Response_WarnListSchema, ServerInfo_UserSchema,
} from '../../generated';
import { adjustMod } from '../admin/adjustMod';
import { getUserInfo } from '../session/getUserInfo';
import { getAdminNotes } from './getAdminNotes';
import { getBanHistory } from './getBanHistory';
import { getWarnHistory } from './getWarnHistory';
import { getWarnList } from './getWarnList';
import { viewLogHistory } from './viewLogHistory';

const moderator = WebClient.instance.response.moderator;
const admin = WebClient.instance.response.admin;
const session = WebClient.instance.response.session;
const user = create(ServerInfo_UserSchema, { name: 'alice' });
const warnings = create(Response_WarnListSchema, { userName: 'alice', warning: ['Reason'] });
const filters = create(Command_ViewLogHistorySchema, { userName: 'alice' });
it.each([undefined, 'alice'])('uses the log filter target %s on correlated failure', (userName) => {
  const sender = WebClient.instance.protobuf.sendModeratorCommand as Mock;
  viewLogHistory({ userName }, 'logs');
  expect(sender).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ typeName: 'Command_ViewLogHistory.ext' }),
    create(Command_ViewLogHistorySchema, { userName }),
    expect.objectContaining({ onError: expect.any(Function) }),
  );
  makeCallbackHelpers(sender).getLastSendOpts().onError(3, {}, CommandFailure.Timeout);
  expect(moderator.commandFailed).toHaveBeenCalledExactlyOnceWith(
    'viewLogHistory', 3, userName ?? '', CommandFailure.Timeout, 'logs',
  );
});

const cases = [
  {
    name: 'banHistory', send: (...id: [requestId?: RequestId]) => getBanHistory('alice', ...id),
    response: create(Response_BanHistorySchema), success: moderator.banHistory, successArgs: ['alice', []],
  },
  {
    name: 'warnHistory', send: (...id: [requestId?: RequestId]) => getWarnHistory('alice', ...id),
    response: create(Response_WarnHistorySchema), success: moderator.warnHistory, successArgs: ['alice', []],
  },
  {
    name: 'getAdminNotes', send: (...id: [requestId?: RequestId]) => getAdminNotes('alice', ...id),
    response: create(Response_GetAdminNotesSchema, { notes: 'Private notes' }),
    success: moderator.getAdminNotes, successArgs: ['alice', 'Private notes'],
  },
  {
    name: 'warnList', send: (...id: [requestId?: RequestId]) => getWarnList('mod', 'alice', 'cid', ...id),
    response: warnings, success: moderator.warnListOptions, successArgs: [[warnings]],
  },
  {
    name: 'viewLogHistory', send: (...id: [requestId?: RequestId]) => viewLogHistory(filters, ...id),
    response: create(Response_ViewLogHistorySchema), success: moderator.viewLogs, successArgs: [[]],
  },
  {
    name: 'adjustMod', send: (...id: [requestId?: RequestId]) => adjustMod('alice', true, undefined, undefined, ...id),
    response: undefined, success: admin.adjustMod, successArgs: ['alice', true, undefined, undefined],
  },
  {
    name: 'getUserInfo', send: (...id: [requestId?: RequestId]) => getUserInfo('alice', ...id),
    response: create(Response_GetUserInfoSchema, { userInfo: user }), success: session.getUserInfo, successArgs: [user],
  },
];

describe.each(cases)('$name request identity', ({ name, send, response, success, successArgs }) => {
  const sender = (name === 'adjustMod' ? WebClient.instance.protobuf.sendAdminCommand
    : name === 'getUserInfo' ? WebClient.instance.protobuf.sendSessionCommand
      : WebClient.instance.protobuf.sendModeratorCommand) as Mock;
  const failureCallback = name === 'adjustMod' ? admin.commandFailed
    : name === 'getUserInfo' ? session.getUserInfoFailed : moderator.commandFailed;
  const failureArgs = (failure?: CommandFailure) => name === 'getUserInfo' ? ['alice', 3] : [name, 3, 'alice', failure];
  const { getLastSendOpts } = makeCallbackHelpers(sender);

  it('keeps identity on reversed replies without putting it on the wire', () => {
    send('first');
    const first = getLastSendOpts();
    send('second');
    const second = getLastSendOpts();
    expect(sender.mock.calls[0][1]).toEqual(sender.mock.calls[1][1]);
    expect(sender.mock.calls[0][1]).not.toHaveProperty('requestId');
    second.onSuccess(response);
    first.onSuccess(response);
    expect(success).toHaveBeenNthCalledWith(1, ...successArgs, 'second');
    expect(success).toHaveBeenNthCalledWith(2, ...successArgs, 'first');
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'echoes identity on failure %s', (failure) => {
      send('request');
      getLastSendOpts().onError(3, {}, failure);
      expect(failureCallback).toHaveBeenCalledWith(...failureArgs(failure), 'request');
    },
  );

  it('preserves omitted-correlation callback arity', () => {
    send();
    getLastSendOpts().onSuccess(response);
    getLastSendOpts().onError(3, {}, undefined);
    expect(success).toHaveBeenCalledWith(...successArgs);
    expect(failureCallback).toHaveBeenCalledWith(...failureArgs());
  });
});

it('keeps concurrent promote and demote flags paired with their own identities', () => {
  const { getLastSendOpts } = makeCallbackHelpers(WebClient.instance.protobuf.sendAdminCommand as Mock);
  adjustMod('alice', true, undefined, undefined, 'promote');
  const promote = getLastSendOpts();
  adjustMod('alice', false, undefined, undefined, 'demote');
  getLastSendOpts().onSuccess();
  promote.onSuccess();
  expect(admin.adjustMod).toHaveBeenNthCalledWith(1, 'alice', false, undefined, undefined, 'demote');
  expect(admin.adjustMod).toHaveBeenNthCalledWith(2, 'alice', true, undefined, undefined, 'promote');
});
