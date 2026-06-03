import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { activePlayersOf } from './activePlayers';

function gameWith(specs: Array<{ id: number; spectator?: boolean; conceded?: boolean }>) {
  const players: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  for (const s of specs) {
    players[s.id] = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: s.id,
        spectator: s.spectator ?? false,
        conceded: s.conceded ?? false,
      }),
    });
  }
  return makeGameEntry({ players });
}

describe('activePlayersOf', () => {
  it('keeps seated, in-play players', () => {
    const game = gameWith([{ id: 1 }, { id: 2 }]);
    expect(activePlayersOf(game).map((p) => p.properties.playerId)).toEqual([1, 2]);
  });

  it('excludes spectators', () => {
    const game = gameWith([{ id: 1 }, { id: 99, spectator: true }]);
    expect(activePlayersOf(game).map((p) => p.properties.playerId)).toEqual([1]);
  });

  it('excludes conceded players', () => {
    const game = gameWith([{ id: 1 }, { id: 2, conceded: true }]);
    expect(activePlayersOf(game).map((p) => p.properties.playerId)).toEqual([1]);
  });

  it('returns an empty list when there are no players', () => {
    expect(activePlayersOf(makeGameEntry({ players: {} }))).toEqual([]);
  });
});
