import { makeGameEntry, makeGameInfo, makePlayerEntry } from '@cockatrice/datatrice/testing';

import { myOpenGame } from './myOpenGame';

const entry = (gameId: number, overrides: Parameters<typeof makeGameEntry>[0] = {}) =>
  makeGameEntry({ info: makeGameInfo({ gameId, maxPlayers: 2, description: `g${gameId}` }), ...overrides });

describe('myOpenGame', () => {
  it('finds the unstarted game you sit in that still has a free seat', () => {
    expect(myOpenGame({ 4: entry(4, { hostId: 1, localPlayerId: 1 }) })).toEqual({
      gameId: 4, description: 'g4', seated: 1, max: 2, hosting: true,
    });
  });

  it('ignores started, full, spectated and replay games', () => {
    expect(myOpenGame({
      1: entry(1, { started: true }),
      2: entry(2, { players: { 1: makePlayerEntry(), 2: makePlayerEntry() } }),
      3: entry(3, { spectator: true }),
      4: entry(4, { replay: true }),
    })).toBeNull();
  });

  it('prefers a game you host over one you joined', () => {
    expect(myOpenGame({
      7: entry(7, { hostId: 2, localPlayerId: 1 }),
      5: entry(5, { hostId: 1, localPlayerId: 1 }),
    })?.gameId).toBe(5);
  });
});
