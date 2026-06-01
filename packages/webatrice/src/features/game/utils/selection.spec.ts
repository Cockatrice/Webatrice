import { describe, expect, it } from 'vitest';

import { GameEntry } from '@cockatrice/datatrice';

import { makeCardKey } from './CardRegistry/CardRegistryContext';
import { resolveSelectedCards, type SelectedCard } from './selection';

function card(id: number, tapped = false) {
  return { id, tapped } as SelectedCard['card'];
}

const game = {
  players: {
    0: {
      zones: {
        table: { byId: { 1: card(1, false), 2: card(2, true) } },
      },
    },
    1: {
      zones: {
        grave: { byId: { 5: card(5) } },
      },
    },
  },
} as unknown as GameEntry;

describe('resolveSelectedCards', () => {
  it('resolves live cards and drops keys with no matching card', () => {
    const keys = new Set([
      makeCardKey(0, 'table', 1),
      makeCardKey(0, 'table', 99), // gone
      makeCardKey(1, 'grave', 5),
    ]);
    const resolved = resolveSelectedCards(game, keys);
    expect(resolved).toHaveLength(2);
    expect(resolved).toEqual(
      expect.arrayContaining([
        { ownerPlayerId: 0, zone: 'table', card: game.players[0].zones.table.byId[1] },
        { ownerPlayerId: 1, zone: 'grave', card: game.players[1].zones.grave.byId[5] },
      ]),
    );
  });
});
