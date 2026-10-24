import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { summarizeStack } from './stackSummary';

function seat(playerId: number, name: string | undefined, cards: ReturnType<typeof makeCard>[]) {
  return {
    properties: { playerId, userInfo: name ? { name } : undefined },
    zones: {
      [ZoneName.STACK]: {
        order: cards.map((c) => c.id),
        byId: Object.fromEntries(cards.map((c) => [c.id, c])),
      },
    },
  };
}

describe('summarizeStack', () => {
  it('lists every seat\'s stack cards in seat order, bottom to top, with their owner', () => {
    const items = summarizeStack([
      seat(1, 'Alice', [makeCard({ id: 10, name: 'Counterspell', providerId: 'cs' })]),
      seat(2, undefined, [makeCard({ id: 20, name: 'Lightning Bolt' }), makeCard({ id: 21, name: 'Opt', annotation: 'Owner: Bob' })]),
    ]);
    expect(items.map((i) => [i.key, i.playerId, i.playerName, i.card.name, i.card.scryfallId, i.card.annotation])).toEqual([
      ['1:10', 1, 'Alice', 'Counterspell', 'cs', undefined],
      ['2:20', 2, undefined, 'Lightning Bolt', '', undefined],
      ['2:21', 2, undefined, 'Opt', '', 'Owner: Bob'],
    ]);
  });

  it('skips seats without a stack zone', () => {
    expect(summarizeStack([{ properties: { playerId: 3 }, zones: {} }])).toEqual([]);
  });
});
