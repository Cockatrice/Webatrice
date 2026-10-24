
vi.mock('../../WebClient');

import { create, isFieldSet } from '@bufbuild/protobuf';
import { Mock } from 'vitest';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { WebClient } from '../../WebClient';
import {
  Command_AddCardArtRule_ext,
  Command_GetModeratorLastLogins_ext,
  Command_GetUserAlts_ext,
  Command_GetUserSessions_ext,
  Command_GetUserSessionsSchema,
  Command_ListCardArtRules_ext,
  Command_RemoveCardArtRule_ext,
  Command_RemoveUserAvatar_ext,
  Response_CardArtRuleEntrySchema,
  Response_ListCardArtRules_ext,
  Response_ModeratorLastLogins_ext,
  Response_RemoveUserAvatar_ext,
  Response_ResponseCode,
  Response_UserAlts_ext,
  Response_UserSessions_ext,
  ServerInfo_ModeratorLoginSchema,
  ServerInfo_UserAltSchema,
  ServerInfo_UserSessionSchema,
} from '../../generated';

import { addCardArtRule } from './addCardArtRule';
import { getModeratorLastLogins } from './getModeratorLastLogins';
import { getUserAlts } from './getUserAlts';
import { getUserSessions } from './getUserSessions';
import { listCardArtRules } from './listCardArtRules';
import { removeCardArtRule } from './removeCardArtRule';
import { removeUserAvatar } from './removeUserAvatar';
import { reportUserInfo } from './reportUserInfo';

const { invokeOnSuccess, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendModeratorCommand as Mock,
  2
);

describe('addCardArtRule', () => {

  it('calls sendModeratorCommand with Command_AddCardArtRule', () => {
    addCardArtRule('Island', 'abc', 'DENY', 'nsfw');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_AddCardArtRule_ext,
      expect.objectContaining({ cardName: 'Island', cardProviderId: 'abc', mode: 'DENY', reason: 'nsfw' }),
      expect.any(Object)
    );
  });

  it('onSuccess calls response.moderator.cardArtRuleAdded with an empty default reason', () => {
    addCardArtRule('Island', 'abc', 'ALLOW');
    invokeOnSuccess();
    expect(WebClient.instance.response.moderator.cardArtRuleAdded).toHaveBeenCalledWith('Island', 'abc', 'ALLOW', '');
  });

  it('does not call response.moderator.cardArtRuleAdded on RespInvalidData', () => {
    addCardArtRule('Island', 'abc', 'ALLOW');
    invokeOnError(Response_ResponseCode.RespInvalidData);
    expect(WebClient.instance.response.moderator.cardArtRuleAdded).not.toHaveBeenCalled();
  });
});

describe('removeCardArtRule', () => {

  it('calls sendModeratorCommand with Command_RemoveCardArtRule and reports the removal', () => {
    removeCardArtRule('Island', 'abc');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_RemoveCardArtRule_ext,
      expect.objectContaining({ cardName: 'Island', cardProviderId: 'abc' }),
      expect.any(Object)
    );
    invokeOnSuccess();
    expect(WebClient.instance.response.moderator.cardArtRuleRemoved).toHaveBeenCalledWith('Island', 'abc');
  });
});

describe('listCardArtRules', () => {

  it('calls sendModeratorCommand with Command_ListCardArtRules and forwards the entries', () => {
    listCardArtRules();
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_ListCardArtRules_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_ListCardArtRules_ext })
    );
    const entries = [create(Response_CardArtRuleEntrySchema, { cardName: 'Island', mode: 'DENY' })];
    invokeOnSuccess({ entries });
    expect(WebClient.instance.response.moderator.cardArtRules).toHaveBeenCalledWith(entries);
  });
});

describe('getUserSessions', () => {

  it('calls sendModeratorCommand with Command_GetUserSessions', () => {
    getUserSessions('alice', 20);
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GetUserSessions_ext,
      expect.objectContaining({ userName: 'alice', limit: 20 }),
      expect.objectContaining({ responseExt: Response_UserSessions_ext })
    );
  });

  it('leaves limit unset so the server default (110) applies', () => {
    getUserSessions('alice');
    const sent = (WebClient.instance.protobuf.sendModeratorCommand as Mock).mock.calls.at(-1)![1];
    expect(isFieldSet(sent, Command_GetUserSessionsSchema.field.limit)).toBe(false);
  });

  it('onSuccess forwards the sessions keyed by user', () => {
    getUserSessions('alice');
    const sessions = [create(ServerInfo_UserSessionSchema, { userName: 'alice', connectionType: 'websocket' })];
    invokeOnSuccess({ sessions });
    expect(WebClient.instance.response.moderator.userSessions).toHaveBeenCalledWith('alice', sessions);
  });
});

describe('getUserAlts', () => {

  it('calls sendModeratorCommand with Command_GetUserAlts and forwards the alts', () => {
    getUserAlts('alice');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GetUserAlts_ext,
      expect.objectContaining({ userName: 'alice' }),
      expect.objectContaining({ responseExt: Response_UserAlts_ext })
    );
    const alts = [create(ServerInfo_UserAltSchema, { userName: 'alice2', banCount: 1 })];
    invokeOnSuccess({ alts });
    expect(WebClient.instance.response.moderator.userAlts).toHaveBeenCalledWith('alice', alts);
  });
});

describe('getModeratorLastLogins', () => {

  it('calls sendModeratorCommand with Command_GetModeratorLastLogins and forwards the logins', () => {
    getModeratorLastLogins();
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GetModeratorLastLogins_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_ModeratorLastLogins_ext })
    );
    const logins = [create(ServerInfo_ModeratorLoginSchema, { userName: 'mod1', lastLogin: 1700000000n })];
    invokeOnSuccess({ logins });
    expect(WebClient.instance.response.moderator.moderatorLastLogins).toHaveBeenCalledWith(logins);
  });
});

describe('removeUserAvatar', () => {

  it('calls sendModeratorCommand with Command_RemoveUserAvatar', () => {
    removeUserAvatar('alice');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_RemoveUserAvatar_ext,
      expect.objectContaining({ userName: 'alice' }),
      expect.objectContaining({ responseExt: Response_RemoveUserAvatar_ext })
    );
  });

  it('onSuccess reports the account name the server echoed', () => {
    removeUserAvatar(' alice ');
    invokeOnSuccess({ userName: 'alice' });
    expect(WebClient.instance.response.moderator.userAvatarRemoved).toHaveBeenCalledWith('alice');
  });

  it('falls back to the requested name when the server echoes none', () => {
    removeUserAvatar('alice');
    invokeOnSuccess({ userName: '' });
    expect(WebClient.instance.response.moderator.userAvatarRemoved).toHaveBeenCalledWith('alice');
  });

  it('does not call response.moderator.userAvatarRemoved on RespNameNotFound', () => {
    removeUserAvatar('ghost');
    invokeOnError(Response_ResponseCode.RespNameNotFound);
    expect(WebClient.instance.response.moderator.userAvatarRemoved).not.toHaveBeenCalled();
  });
});

describe('staff lookup failures', () => {
  const { commandFailed } = WebClient.instance.response.moderator as unknown as { commandFailed: Mock };

  it.each([
    ['reportUserInfo', () => reportUserInfo('alice'), 'alice'],
    ['getUserAlts', () => getUserAlts('alice'), 'alice'],
    ['getUserSessions', () => getUserSessions('alice'), 'alice'],
    ['getModeratorLastLogins', () => getModeratorLastLogins(), ''],
    ['removeUserAvatar', () => removeUserAvatar('alice'), 'alice'],
    ['listCardArtRules', () => listCardArtRules(), ''],
  ])('reports a failed %s through commandFailed with its target', (command, send, target) => {
    send();
    invokeOnError(Response_ResponseCode.RespInternalError);
    expect(commandFailed).toHaveBeenCalledWith(command, Response_ResponseCode.RespInternalError, target, undefined);
  });

  it('passes the transport reason when the server never answered', () => {
    getUserAlts('alice');
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(commandFailed).toHaveBeenCalledWith(
      'getUserAlts', Response_ResponseCode.RespNotConnected, 'alice', CommandFailure.Disconnected,
    );
  });
});
