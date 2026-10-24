import { countDeckCards, deckSectionOf, groupDeckCards, sortIndicesByName } from './deckGrouping';
import type { DeckCard } from './types';

function card(name: string, overrides: Partial<DeckCard> = {}): DeckCard {
  return { name, quantity: 1, category: 'main', lookupSource: 'scryfall', ...overrides };
}

describe('deckSectionOf', () => {
  it('puts commander-marked cards under Commander only in commander decks', () => {
    const atraxa = card('Atraxa', { isCommander: true, typeLine: 'Legendary Creature — Angel' });
    expect(deckSectionOf(atraxa, true)).toBe('Commander');
    expect(deckSectionOf(atraxa, false)).toBe('Creature');
  });

  it('puts every sideboard card under Sideboard regardless of type', () => {
    expect(deckSectionOf(card('Negate', { category: 'sideboard', typeLine: 'Instant' }), false)).toBe('Sideboard');
  });

  it('falls back to Other for cards without a type line', () => {
    expect(deckSectionOf(card('Unknown'), false)).toBe('Other');
  });
});

describe('groupDeckCards', () => {
  it('orders sections canonically, drops empty ones, and sorts rows by name', () => {
    const cards = [
      card('Forest', { typeLine: 'Basic Land — Forest', quantity: 10 }),
      card('zap', { typeLine: 'Instant' }),
      card('Atraxa', { isCommander: true, typeLine: 'Legendary Creature' }),
      card('Abrade', { typeLine: 'Instant' }),
      card('Negate', { category: 'sideboard', typeLine: 'Instant' }),
    ];
    expect(groupDeckCards(cards, true)).toEqual([
      { label: 'Commander', indices: [2] },
      { label: 'Instant', indices: [3, 1] },
      { label: 'Land', indices: [0] },
      { label: 'Sideboard', indices: [4] },
    ]);
  });

  it('returns no sections for an empty deck', () => {
    expect(groupDeckCards([], true)).toEqual([]);
  });
});

describe('sortIndicesByName', () => {
  it('uses one collator for a sort and preserves stable case and accent ties without numeric sorting', () => {
    const cards = ['b', 'á', 'A', 'a 2', 'a 10'].map((name) => card(name));
    const indices = cards.map((_, i) => i);
    const expected = [...indices].sort((a, b) => cards[a].name.localeCompare(cards[b].name, undefined, { sensitivity: 'base' }));
    const collator = vi.spyOn(Intl, 'Collator');
    try {
      expect(sortIndicesByName(cards, indices)).toEqual(expected);
      expect(collator).toHaveBeenCalledExactlyOnceWith(undefined, { sensitivity: 'base' });
    } finally {
      collator.mockRestore();
    }
  });

  it('sorts case-insensitively by card name', () => {
    const cards = [card('b'), card('A'), card('c')];
    expect(sortIndicesByName(cards, [0, 1, 2])).toEqual([1, 0, 2]);
  });
});

describe('countDeckCards', () => {
  it('counts main (commander included) and sideboard quantities separately', () => {
    expect(countDeckCards([
      card('Atraxa', { isCommander: true }),
      card('Forest', { quantity: 10 }),
      card('Negate', { category: 'sideboard', quantity: 2 }),
    ])).toEqual({ totalMainboardCount: 11, totalSideboardCount: 2 });
    expect(countDeckCards(undefined)).toEqual({ totalMainboardCount: 0, totalSideboardCount: 0 });
  });
});
