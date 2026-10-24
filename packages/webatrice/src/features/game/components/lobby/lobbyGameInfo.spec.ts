import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { ServerInfo_GameSchema } from '@cockatrice/sockatrice/generated';

import { lobbyGameFacts } from './lobbyGameInfo';

const info = (overrides: MessageInitShape<typeof ServerInfo_GameSchema> = {}) =>
  create(ServerInfo_GameSchema, { gameId: 1, maxPlayers: 4, spectatorsAllowed: true, ...overrides });

describe('lobbyGameFacts', () => {
  it('reads the game settings the server sent with the join', () => {
    const facts = lobbyGameFacts(
      info({
        description: ' Pod night ',
        gameTypes: [3],
        withPassword: true,
        onlyRegistered: true,
        spectatorsCanChat: true,
        spectatorsNeedPassword: true,
        shareDecklistsOnLoad: true,
      }),
      { gametypeMap: { 3: 'Commander' }, seated: 2 },
    );
    expect(facts).toEqual({
      description: 'Pod night',
      formats: ['Commander'],
      seats: { taken: 2, max: 4 },
      audience: 'registered',
      hasPassword: true,
      spectators: { canChat: true, seeEverything: false, needPassword: true },
      shareDecklists: true,
    });
  });

  it('puts buddies-only above registered-only, and no spectators as null', () => {
    const facts = lobbyGameFacts(info({ onlyBuddies: true, onlyRegistered: true, spectatorsAllowed: false }), {
      gametypeMap: {},
      seated: 1,
    });
    expect(facts.audience).toBe('buddies');
    expect(facts.spectators).toBeNull();
    expect(lobbyGameFacts(info(), { gametypeMap: {}, seated: 1 }).audience).toBe('anyone');
  });

  it('reports no game type as an empty list and an unresolvable one as unknown', () => {
    expect(lobbyGameFacts(info(), { gametypeMap: { 3: 'Commander' }, seated: 1 }).formats).toEqual([]);
    expect(lobbyGameFacts(info({ gameTypes: [9] }), { gametypeMap: { 3: 'Commander' }, seated: 1 }).formats).toBeNull();
    expect(lobbyGameFacts(info({ gameTypes: [3] }), { gametypeMap: undefined, seated: 1 }).formats).toBeNull();
  });

  it('falls back to the seated count when the game has no seat limit', () => {
    expect(lobbyGameFacts(info({ maxPlayers: 0 }), { gametypeMap: {}, seated: 3 }).seats).toEqual({ taken: 3, max: 3 });
  });
});
