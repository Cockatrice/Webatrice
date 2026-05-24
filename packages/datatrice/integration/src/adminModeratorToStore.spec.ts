import { create } from '@bufbuild/protobuf';

import { attachResponseHandlers, createStore, server } from '../../src';
import {
  Response_WarnListSchema,
  ServerInfo_BanSchema,
  ServerInfo_ChatMessageSchema,
  ServerInfo_User,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
  ServerInfo_WarningSchema,
} from '@cockatrice/sockatrice/generated';

// Integration: drives every AdminResponseImpl and ModeratorResponseImpl
// handler method through the real store. Admin: mod adjustment + the
// signal-only config/shutdown actions. Moderator: ban history, warn
// history/options, log viewing, admin notes, replay access and forced
// activation. Assertions read through server.selectors where one exists.

function makeUser(name: string, userLevel = 0): ServerInfo_User {
  return create(ServerInfo_UserSchema, { name, userLevel, accountageSecs: 0n });
}

// --- admin ---------------------------------------------------------------

describe('integration: admin handlers', () => {
  it('adjustMod grants and revokes the moderator flag on a known user', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUsers([makeUser('alice')]);

    response.admin.adjustMod('alice', true, false);
    let user = server.Selectors.getUsers(store.getState())['alice'];
    expect(user.userLevel & ServerInfo_User_UserLevelFlag.IsModerator).toBeTruthy();

    response.admin.adjustMod('alice', false, false);
    user = server.Selectors.getUsers(store.getState())['alice'];
    expect(user.userLevel & ServerInfo_User_UserLevelFlag.IsModerator).toBeFalsy();
  });

  it('adjustMod grants the judge flag', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUsers([makeUser('bob')]);

    response.admin.adjustMod('bob', false, true);
    const user = server.Selectors.getUsers(store.getState())['bob'];
    expect(user.userLevel & ServerInfo_User_UserLevelFlag.IsJudge).toBeTruthy();
  });

  it('adjustMod on an unknown user is a no-op', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    expect(() => response.admin.adjustMod('ghost', true, true)).not.toThrow();
    expect(server.Selectors.getUsers(store.getState())['ghost']).toBeUndefined();
  });

  it('signal-only admin actions flow through the bridge without error', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    expect(() => {
      response.admin.reloadConfig();
      response.admin.shutdownServer();
      response.admin.updateServerMessage();
    }).not.toThrow();
  });
});

// --- moderator -----------------------------------------------------------

describe('integration: moderator handlers', () => {
  it('banFromServer records the banned username', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.moderator.banFromServer('troll');
    expect(store.getState().server.banUser).toBe('troll');
  });

  it('warnUser records the warned username', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.moderator.warnUser('spammer');
    expect(store.getState().server.warnUser).toBe('spammer');
  });

  it('banHistory stores ban records keyed by username', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const bans = [create(ServerInfo_BanSchema, {
      adminName: 'mod', banReason: 'cheating', banTime: '2024', banLength: '7',
    })];
    response.moderator.banHistory('troll', bans);
    expect(store.getState().server.banHistory['troll']).toEqual(bans);
  });

  it('warnHistory stores warning records keyed by username', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const warnings = [create(ServerInfo_WarningSchema, {
      userName: 'troll', adminName: 'mod', reason: 'rude', timeOf: '2024',
    })];
    response.moderator.warnHistory('troll', warnings);
    expect(store.getState().server.warnHistory['troll']).toEqual(warnings);
  });

  it('warnListOptions replaces the available warn list', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const list = [create(Response_WarnListSchema, { userName: 'troll', warning: ['Spam'] })];
    response.moderator.warnListOptions(list);
    expect(store.getState().server.warnListOptions).toEqual(list);
  });

  it('viewLogs normalizes chat logs into grouped buckets', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.moderator.viewLogs([
      create(ServerInfo_ChatMessageSchema, { message: 'hi', targetType: 'room', senderName: 'alice' }),
      create(ServerInfo_ChatMessageSchema, { message: 'gg', targetType: 'game', senderName: 'bob' }),
    ]);
    const logs = server.Selectors.getLogs(store.getState());
    expect(logs.room).toHaveLength(1);
    expect(logs.game).toHaveLength(1);
    expect(logs.chat).toHaveLength(0);
  });

  it('getAdminNotes and updateAdminNotes store notes keyed by username', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.moderator.getAdminNotes('alice', 'initial note');
    expect(store.getState().server.adminNotes['alice']).toBe('initial note');

    response.moderator.updateAdminNotes('alice', 'updated note');
    expect(store.getState().server.adminNotes['alice']).toBe('updated note');
  });

  it('signal-only moderator actions flow through the bridge without error', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    expect(() => {
      response.moderator.grantReplayAccess(42, 'mod');
      response.moderator.forceActivateUser('newbie', 'mod');
    }).not.toThrow();
  });
});
