import { create } from '@bufbuild/protobuf';

import { attachResponseHandlers, createStore, server } from '../../src';
import {
  Response_CardArtRuleEntrySchema,
  Response_GetServerStatsSchema,
  Response_ReportUserInfoSchema,
  ServerInfo_ModeratorLoginSchema,
  ServerInfo_UserAltSchema,
  ServerInfo_UserSchema,
  ServerInfo_UserSessionSchema,
} from '@cockatrice/sockatrice/generated';

describe('integration: staff tools', () => {
  it('builds a user investigation from the three moderation lookups', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    store.dispatch(server.Actions.userInvestigationStarted({ userName: 'alice' }));
    response.moderator.reportUserInfo!(create(Response_ReportUserInfoSchema, { userName: 'alice', totalWarns: 1 }));
    response.moderator.userAlts!('alice', [create(ServerInfo_UserAltSchema, { userName: 'alice_alt', banCount: 2 })]);
    response.moderator.userSessions!('alice', [create(ServerInfo_UserSessionSchema, { ipAddress: '10.0.0.1' })]);

    const investigation = server.Selectors.getUserInvestigation(store.getState(), 'alice');
    expect(investigation?.info?.totalWarns).toBe(1);
    expect(investigation?.alts?.map((alt) => alt.userName)).toEqual(['alice_alt']);
    expect(investigation?.sessions?.[0].ipAddress).toBe('10.0.0.1');
  });

  it('stores staff last logins and the developer stats snapshot', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.moderator.moderatorLastLogins!([create(ServerInfo_ModeratorLoginSchema, { userName: 'mod' })]);
    response.developer!.serverStats!(create(Response_GetServerStatsSchema, { gamesCount: 5n }));

    expect(server.Selectors.getModeratorLastLogins(store.getState())?.[0].userName).toBe('mod');
    expect(server.Selectors.getServerStats(store.getState())?.gamesCount).toBe(5n);
  });

  it('updates the card-art cache only from the authoritative list response', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.moderator.cardArtRules!([create(Response_CardArtRuleEntrySchema, { cardName: 'Island', cardProviderId: 'a' })]);
    response.moderator.cardArtRuleAdded!('Forest', 'b', 'ALLOW', '');
    response.moderator.cardArtRuleRemoved!('Island', 'a');

    expect(server.Selectors.getCardArtRules(store.getState())?.map((r) => r.cardName)).toEqual(['Island']);
    response.moderator.cardArtRules!([create(Response_CardArtRuleEntrySchema, { cardName: 'Forest', cardProviderId: 'b' })]);
    expect(server.Selectors.getCardArtRules(store.getState())?.map((r) => r.cardName)).toEqual(['Forest']);
  });

  it('clears a removed avatar from the cached profile without mutating the stored message', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.getUserInfo(create(ServerInfo_UserSchema, { name: 'alice', avatarBmp: new Uint8Array([7]) }));
    const before = server.Selectors.getUserInfoByName(store.getState(), 'alice');

    response.moderator.userAvatarRemoved!('alice');

    const after = server.Selectors.getUserInfoByName(store.getState(), 'alice');
    expect(after).not.toBe(before);
    expect(after?.avatarBmp).toHaveLength(0);
  });
});
