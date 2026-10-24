import { makeCard, makeCounter, makeGameEntry, makePlayerEntry, makePlayerProperties, makeZoneEntry } from '@cockatrice/datatrice/testing';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { makeUser } from '../../__test-utils__';
import { buildPreviewBoardModel } from './usePreviewBoardModel';

function seat(playerId: number, name: string, overrides: Parameters<typeof makePlayerEntry>[0] = {}) {
  return makePlayerEntry({
    properties: makePlayerProperties({ playerId, userInfo: makeUser({ name, userLevel: ServerInfo_User_UserLevelFlag.IsUser }) }),
    ...overrides,
  });
}

describe('buildPreviewBoardModel', () => {
  it('is empty without a game', () => {
    expect(buildPreviewBoardModel(undefined)).toEqual({ seats: [], activePlayerName: undefined, phase: undefined, stack: [] });
  });

  it('projects each seated player with life, zone counts, battlefield cards and the stack', () => {
    const game = makeGameEntry({
      activePlayerId: 2,
      activePhase: 3,
      players: {
        1: seat(1, 'alice', {
          counters: { 5: makeCounter({ id: 5, name: 'Life', count: 17 }) },
          zones: {
            hand: makeZoneEntry({ name: 'hand', cardCount: 4 }),
            deck: makeZoneEntry({ name: 'deck', cardCount: 41 }),
            table: makeZoneEntry({
              name: 'table',
              cards: [
                makeCard({ id: 10, name: 'Forest', tapped: true }),
                makeCard({ id: 11, name: 'Grizzly Bears', counterList: [{ id: 1, value: 2 }] }),
                makeCard({ id: 12, name: 'Rancor', attachCardId: 11 }),
              ],
            }),
            stack: makeZoneEntry({ name: 'stack', cards: [makeCard({ id: 20, name: 'Lightning Bolt' })] }),
          },
        }),
        2: seat(2, 'bob'),
        3: seat(3, 'carol', { properties: makePlayerProperties({ playerId: 3, spectator: true }) }),
      },
    });

    const model = buildPreviewBoardModel(game);

    expect(model.seats.map((s) => s.name)).toEqual(['alice', 'bob']);
    expect(model.seats[0]).toMatchObject({ life: 17, handCount: 4, libraryCount: 41, isActive: false });
    expect(model.seats[0].battlefield).toEqual([
      { id: 10, name: 'Forest', providerId: '', tapped: true, faceDown: false, counters: 0, attached: false },
      { id: 11, name: 'Grizzly Bears', providerId: '', tapped: false, faceDown: false, counters: 2, attached: false },
      { id: 12, name: 'Rancor', providerId: '', tapped: false, faceDown: false, counters: 0, attached: true },
    ]);
    expect(model.seats[1]).toMatchObject({ life: undefined, handCount: 0, libraryCount: 0, battlefield: [], isActive: true });
    expect(model).toMatchObject({ activePlayerName: 'bob', phase: 3, stack: ['Lightning Bolt'] });
  });

  it('has no phase before the game starts', () => {
    expect(buildPreviewBoardModel(makeGameEntry({ activePhase: -1 })).phase).toBeUndefined();
  });
});
