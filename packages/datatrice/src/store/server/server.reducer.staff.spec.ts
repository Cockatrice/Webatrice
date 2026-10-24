import { create } from '@bufbuild/protobuf';
import {
  Response_CardArtRuleEntrySchema,
  Response_GetServerStatsSchema,
  Response_ReportUserInfoSchema,
  ServerInfo_ModeratorLoginSchema,
  ServerInfo_UserAltSchema,
  ServerInfo_UserSessionSchema,
} from '@cockatrice/sockatrice/generated';
import { serverReducer } from './server.reducer';
import { Actions } from './server.actions';
import { Selectors } from './server.selectors';
import { ServerState } from './server.interfaces';
import { makeServerState, makeUser } from '../../testing/fixtures/server';

const rootState = (server: ServerState) => ({ server });

const rule = (cardName: string, cardProviderId: string, mode = 'DENY', reason = '') =>
  create(Response_CardArtRuleEntrySchema, { cardName, cardProviderId, mode, reason });

describe('staff tooling state', () => {
  it('starts with nothing loaded', () => {
    const state = makeServerState();
    expect(Selectors.getUserInvestigation(rootState(state), 'alice')).toBeUndefined();
    expect(Selectors.getModeratorLastLogins(rootState(state))).toBeNull();
    expect(Selectors.getCardArtRules(rootState(state))).toBeNull();
    expect(Selectors.getServerStats(rootState(state))).toBeNull();
  });

  it('is cleared when the connection is re-initialized', () => {
    let state = serverReducer(startInvestigation(makeServerState(), 'alice'), Actions.userAlts({ userName: 'alice', alts: [] }));
    state = serverReducer(state, Actions.initialized());
    expect(state.staff.investigation).toBeNull();
  });
});

describe('user investigation', () => {
  it('collects the info report, alts and sessions of a user independently', () => {
    const info = create(Response_ReportUserInfoSchema, { userName: 'alice', totalBans: 2 });
    const alts = [create(ServerInfo_UserAltSchema, { userName: 'alice2' })];
    const sessions = [create(ServerInfo_UserSessionSchema, { userName: 'alice', ipAddress: '1.2.3.4' })];

    let state = serverReducer(startInvestigation(makeServerState(), 'alice'), Actions.userAlts({ userName: 'alice', alts }));
    expect(Selectors.getUserInvestigation(rootState(state), 'alice')).toEqual({ alts });

    state = serverReducer(state, Actions.userSessions({ userName: 'alice', sessions }));
    state = serverReducer(state, Actions.userInfoReport({ info }));

    const investigation = Selectors.getUserInvestigation(rootState(state), 'alice');
    expect(investigation?.alts).toBe(alts);
    expect(investigation?.sessions).toBe(sessions);
    expect(investigation?.info).toBe(info);
  });

  it('keys the info report by the name the server echoed', () => {
    const info = create(Response_ReportUserInfoSchema, { userName: 'bob' });
    const state = serverReducer(startInvestigation(makeServerState(), 'bob'), Actions.userInfoReport({ info }));
    expect(Selectors.getUserInvestigation(rootState(state), 'bob')?.info).toBe(info);
  });

  it('replaces an earlier answer for the same user', () => {
    const first = [create(ServerInfo_UserAltSchema, { userName: 'old' })];
    const second = [create(ServerInfo_UserAltSchema, { userName: 'new' })];
    let state = serverReducer(startInvestigation(makeServerState(), 'alice'), Actions.userAlts({ userName: 'alice', alts: first }));
    state = serverReducer(state, Actions.userAlts({ userName: 'alice', alts: second }));
    expect(state.staff.investigation!.results.alts).toBe(second);
  });
});

describe('moderatorLastLogins', () => {
  it('stores the staff login list', () => {
    const logins = [create(ServerInfo_ModeratorLoginSchema, { userName: 'mod', lastLogin: 1700000000n })];
    const state = serverReducer(makeServerState(), Actions.moderatorLastLogins({ logins }));
    expect(Selectors.getModeratorLastLogins(rootState(state))).toBe(logins);
  });
});

describe('userAvatarRemoved', () => {
  it('drops the cached avatar of the user with a fresh message', () => {
    const avatar = new Uint8Array([1, 2, 3]);
    const online = makeUser({ name: 'alice', avatarBmp: avatar });
    const profile = makeUser({ name: 'alice', avatarBmp: avatar });
    const state = makeServerState({ users: { alice: online }, userInfo: { alice: profile } });

    const result = serverReducer(state, Actions.userAvatarRemoved({ userName: 'alice' }));

    expect(result.users.alice).not.toBe(online);
    expect(result.users.alice.avatarBmp).toHaveLength(0);
    expect(result.userInfo.alice.avatarBmp).toHaveLength(0);
    expect(online.avatarBmp).toBe(avatar);
  });

  it('ignores users it has no record of', () => {
    const state = makeServerState();
    expect(serverReducer(state, Actions.userAvatarRemoved({ userName: 'ghost' }))).toEqual(state);
  });
});

describe('card-art rules', () => {
  it('stores the listed rules', () => {
    const entries = [rule('Island', 'a')];
    const state = serverReducer(makeServerState(), Actions.cardArtRules({ entries }));
    expect(Selectors.getCardArtRules(rootState(state))).toBe(entries);
  });

  it('waits for the list response after add acknowledgements', () => {
    let state = serverReducer(makeServerState(), Actions.cardArtRules({ entries: [rule('Island', 'a'), rule('Forest', 'b')] }));

    state = serverReducer(state, Actions.cardArtRuleAdded({ cardName: 'Island', cardProviderId: 'a', mode: 'ALLOW', reason: 'ok' }));
    state = serverReducer(state, Actions.cardArtRuleAdded({ cardName: 'Swamp', cardProviderId: 'c', mode: 'DENY', reason: '' }));

    const rules = Selectors.getCardArtRules(rootState(state))!;
    expect(rules.map((r) => [r.cardName, r.mode])).toEqual([['Island', 'DENY'], ['Forest', 'DENY']]);
    expect(rules[0].reason).toBe('');
  });

  it('waits for the list response after remove acknowledgements', () => {
    let state = serverReducer(makeServerState(), Actions.cardArtRules({ entries: [rule('Island', 'a'), rule('Island', 'b')] }));
    state = serverReducer(state, Actions.cardArtRuleRemoved({ cardName: 'Island', cardProviderId: 'a' }));
    expect(Selectors.getCardArtRules(rootState(state))!.map((r) => r.cardProviderId)).toEqual(['a', 'b']);
  });

  it('leaves a never-loaded list alone until it is fetched', () => {
    const added = Actions.cardArtRuleAdded({ cardName: 'Island', cardProviderId: 'a', mode: 'DENY', reason: '' });
    let state = serverReducer(makeServerState(), added);
    state = serverReducer(state, Actions.cardArtRuleRemoved({ cardName: 'Island', cardProviderId: 'a' }));
    expect(Selectors.getCardArtRules(rootState(state))).toBeNull();
  });
});

describe('serverStats', () => {
  it('keeps the latest developer stats snapshot', () => {
    const stats = create(Response_GetServerStatsSchema, { usersCount: 4n, gamesCount: 1n });
    const state = serverReducer(makeServerState(), Actions.serverStats({ stats }));
    expect(Selectors.getServerStats(rootState(state))).toBe(stats);
  });
});

const startInvestigation = (state: ServerState, userName: string) =>
  serverReducer(state, Actions.userInvestigationStarted({ userName }));

describe('active investigation privacy', () => {
  it('prunes all earlier target data on start, before the next response', () => {
    let state = startInvestigation(makeServerState(), 'alice');
    state = serverReducer(state, Actions.userInfoReport({
      info: create(Response_ReportUserInfoSchema, { userName: 'alice', adminNotes: 'private-note' }),
    }));
    state = serverReducer(state, Actions.userAlts({ userName: 'alice', alts: [
      create(ServerInfo_UserAltSchema, { userName: 'alt', email: 'private@example.test', clientid: 'private-client' }),
    ] }));
    state = serverReducer(state, Actions.userSessions({ userName: 'alice', sessions: [
      create(ServerInfo_UserSessionSchema, { ipAddress: '192.0.2.7', clientid: 'private-session' }),
    ] }));
    state = startInvestigation(state, 'bob');
    expect(Selectors.getUserInvestigation(rootState(state), 'alice')).toBeUndefined();
    expect(Selectors.getUserInvestigation(rootState(state), 'bob')).toEqual({});
    const stored = JSON.stringify(state.staff, (_key, value) => typeof value === 'bigint' ? String(value) : value);
    for (const secret of ['private-note', 'private@example.test', 'private-client', '192.0.2.7', 'private-session']) {
      expect(stored).not.toContain(secret);
    }
  });

  it.each(['info', 'alts', 'sessions'] as const)('ignores a late %s result for a prior target', (part) => {
    let state = startInvestigation(makeServerState(), 'alice');
    state = startInvestigation(state, 'bob');
    const late = {
      info: Actions.userInfoReport({ info: create(Response_ReportUserInfoSchema, { userName: 'alice' }) }),
      alts: Actions.userAlts({ userName: 'alice', alts: [] }),
      sessions: Actions.userSessions({ userName: 'alice', sessions: [] }),
    }[part];
    expect(serverReducer(state, late)).toBe(state);
  });

  it('clears earlier results when refreshing the same target', () => {
    let state = startInvestigation(makeServerState(), 'alice');
    state = serverReducer(state, Actions.userAlts({ userName: 'alice', alts: [] }));
    state = startInvestigation(state, 'alice');
    expect(Selectors.getUserInvestigation(rootState(state), 'alice')).toEqual({});
  });
});
