import type { BracketAssessment } from '@app/types';

import {
  adjustCardQuantity,
  appendCard,
  findMainboardRow,
  normalizeAddedCardName,
  patchCard,
  removeCard,
  mergeDuplicateRows,
  renameDeck,
  setCardCategory,
  setCardCommander,
  setCardPrinting,
  setDeckBanner,
  setDeckBracketAssessment,
  setDeckDescription,
  setDeckFormat,
  setDeckPriceCache,
  setDeckTags,
} from './deckEdits';
import { readDeckTags } from './deckTags';
import type { DeckCard, HydratedDeck } from './types';

function card(name: string, overrides: Partial<DeckCard> = {}): DeckCard {
  return { name, quantity: 1, category: 'main', lookupSource: 'scryfall', ...overrides };
}

function deck(cards: DeckCard[] = []): HydratedDeck {
  return { name: 'Deck', meta: { v: 1, updatedAt: 'x' }, cards, format: 'commander' };
}

const assessment = (level: 1 | 2 | 3 | 4 | 5, fingerprint: string): BracketAssessment => ({
  level, fingerprint, gameChangers: [], turns: [], turnsRestricted: [],
  denial: [], denialRestricted: [], earlyCombos: [], lateCombos: [],
});

describe('deck metadata edits', () => {
  it('renames, reformats and describes without mutating the input', () => {
    const before = deck();
    expect(renameDeck(before, 'New').name).toBe('New');
    expect(setDeckFormat(before, 'Cube').format).toBe('Cube');
    expect(setDeckDescription(before, 'notes').meta.description).toBe('notes');
    expect(setDeckDescription(before, '').meta.description).toBeUndefined();
    expect(before).toEqual(deck());
  });

  it('returns the same deck when a metadata edit changes nothing (no empty undo step)', () => {
    const before = deck();
    expect(renameDeck(before, 'Deck')).toBe(before);
    expect(setDeckFormat(before, 'commander')).toBe(before);
    expect(setDeckDescription(before, '')).toBe(before);
  });

  it('sets and clears the banner card with its printing', () => {
    const bannered = setDeckBanner(deck(), { name: 'Shock', providerId: 'abc' });
    expect(bannered).toEqual(expect.objectContaining({ bannerCard: 'Shock', bannerCardProviderId: 'abc' }));
    expect(setDeckBanner(bannered, { name: 'Shock', providerId: 'abc' })).toBe(bannered);
    const cleared = setDeckBanner(bannered, null);
    expect(cleared.bannerCard).toBeUndefined();
    expect(cleared.bannerCardProviderId).toBeUndefined();
  });

  it('replaces the tags, keeping unknown tag children, and skips an unchanged list', () => {
    const tagged = setDeckTags({ ...deck(), tagsXml: '<tags><note/><tag>Old</tag></tags>' }, ['Aggro', 'Burn']);
    expect(readDeckTags(tagged.tagsXml)).toEqual(['Aggro', 'Burn']);
    expect(tagged.tagsXml).toContain('<note/>');
    expect(setDeckTags(tagged, ['Aggro', 'Burn'])).toBe(tagged);
  });

  it('caches a price and returns the same deck when it is unchanged', () => {
    const priced = setDeckPriceCache(deck(), 12.5, 2);
    expect(priced.meta).toEqual(expect.objectContaining({ priceUsd: 12.5, priceMissingCount: 2 }));
    expect(setDeckPriceCache(priced, 12.5, 2)).toBe(priced);
  });

  it('caches a bracket assessment, mirrors its level, and clears both on undefined', () => {
    const assessed = setDeckBracketAssessment(deck(), assessment(3, 'abc'));
    expect(assessed.meta.bracketLevel).toBe(3);
    expect(assessed.bracketAssessment?.fingerprint).toBe('abc');
    expect(setDeckBracketAssessment(assessed, assessment(3, 'abc'))).toBe(assessed);

    const cleared = setDeckBracketAssessment(assessed, undefined);
    expect(cleared.meta.bracketLevel).toBeUndefined();
    expect(cleared.bracketAssessment).toBeUndefined();
  });
});

describe('card edits', () => {
  const base = deck([card('A', { quantity: 2 }), card('B')]);

  it('patches, recategorizes and removes a row by index', () => {
    expect(patchCard(base, 1, { set: 'lea' }).cards[1].set).toBe('lea');
    expect(setCardCategory(base, 0, 'sideboard').cards[0].category).toBe('sideboard');
    expect(removeCard(base, 0).cards.map((c) => c.name)).toEqual(['B']);
    expect(base.cards.map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('adjusts quantity and drops the row at zero', () => {
    expect(adjustCardQuantity(base, 0, 1).cards[0].quantity).toBe(3);
    expect(adjustCardQuantity(base, 1, -1).cards.map((c) => c.name)).toEqual(['A']);
  });

  it('marks a commander with one copy and leaves the quantity when unmarking', () => {
    const marked = setCardCommander(base, 0, true);
    expect(marked.cards[0]).toEqual(expect.objectContaining({ isCommander: true, quantity: 1 }));
    const twoCopies = patchCard(marked, 0, { quantity: 2 });
    expect(setCardCommander(twoCopies, 0, false).cards[0]).toEqual(expect.objectContaining({ isCommander: false, quantity: 2 }));
    expect(setCardCommander(base, 9, true)).toBe(base);
    expect(setCardCommander(base, 0, false)).toBe(base);
    expect(setCardCommander(marked, 0, true)).toBe(marked);
  });

  it('moves a row between zones only when the zone changes', () => {
    expect(setCardCategory(base, 0, 'main')).toBe(base);
  });

  it('switches a row to another printing, or returns the deck when it is the same printing', () => {
    const reprinted = setCardPrinting(base, 1, {
      set: 'lea',
      collectorNumber: '1',
      scryfallId: 'id',
      imageUri: 'img',
      imageUris: ['img', 'fallback'],
    });
    expect(reprinted.cards[1]).toEqual(expect.objectContaining({
      set: 'lea',
      collectorNumber: '1',
      scryfallId: 'id',
      imageUri: 'img',
      imageUris: ['img', 'fallback'],
    }));
    expect(setCardPrinting(reprinted, 1, { set: 'lea', collectorNumber: '1', scryfallId: 'id' })).toBe(reprinted);
    expect(setCardPrinting(base, 9, { set: 'lea' })).toBe(base);
  });

  it('derives the selected image from the ordered candidate chain', () => {
    const reprinted = setCardPrinting(base, 1, {
      set: 'lea',
      imageUri: 'stale',
      imageUris: ['preferred', 'fallback'],
    });

    expect(reprinted.cards[1]).toMatchObject({
      imageUri: 'preferred',
      imageUris: ['preferred', 'fallback', 'stale'],
    });

    const refreshed = setCardPrinting(reprinted, 1, { set: 'lea', imageUris: ['replacement'] });
    expect(refreshed.cards[1]).toMatchObject({ imageUri: 'replacement', imageUris: ['replacement'] });
  });

  it('merges a row into its twin when a printing change makes them the same card', () => {
    const twins = deck([card('A', { scryfallId: 'a1' }), card('A', { quantity: 2, scryfallId: 'a2' }), card('B')]);
    const merged = setCardPrinting(twins, 1, { scryfallId: 'a1', set: 'lea' });
    expect(merged.cards.map((c) => [c.name, c.quantity, c.scryfallId])).toEqual([['A', 3, 'a1'], ['B', 1, undefined]]);
  });

  it('merges a row into its twin when a zone move lands on the same card and printing', () => {
    const twins = deck([
      card('A', { scryfallId: 'a1', isCommander: true }),
      card('A', { quantity: 2, scryfallId: 'a1', category: 'sideboard' }),
      card('a', { quantity: 1, scryfallId: 'a1', category: 'sideboard' }),
    ]);
    const moved = setCardCategory(twins, 1, 'main');
    expect(moved.cards.map((c) => [c.quantity, c.category, !!c.isCommander])).toEqual([[3, 'main', true], [1, 'sideboard', false]]);
    expect(setCardCategory(moved, 0, 'sideboard').cards.map((c) => [c.quantity, c.category, !!c.isCommander]))
      .toEqual([[4, 'sideboard', true]]);
  });

  it('folds loaded duplicate rows together and leaves a clean list alone', () => {
    const rows = [
      card('A', { scryfallId: 'a1' }), card('B'), card('A', { quantity: 3, scryfallId: 'a1' }), card('A', { scryfallId: 'a2' }),
    ];
    expect(mergeDuplicateRows(rows).map((c) => [c.name, c.quantity, c.scryfallId]))
      .toEqual([['A', 4, 'a1'], ['B', 1, undefined], ['A', 1, 'a2']]);
    expect(mergeDuplicateRows(rows.slice(0, 2))).toEqual(rows.slice(0, 2));
  });

  it('keeps a zone named with a slash apart from a nested zone of the same spelling', () => {
    const rows = [card('A', { zonePath: ['X/Y'] }), card('A', { zonePath: ['X', 'Y'] })];
    expect(mergeDuplicateRows(rows)).toEqual(rows);
  });

  it('appends a new row', () => {
    expect(appendCard(base, card('C')).cards.map((c) => c.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('adding by name', () => {
  it('stores the front face of a double-faced name', () => {
    expect(normalizeAddedCardName('  Riverglide Pathway // Lavaglide Pathway ')).toBe('Riverglide Pathway');
    expect(normalizeAddedCardName(' Sol Ring ')).toBe('Sol Ring');
  });

  it('finds an existing mainboard row case-insensitively, ignoring the sideboard', () => {
    const d = deck([card('Negate', { category: 'sideboard' }), card('Sol Ring')]);
    expect(findMainboardRow(d, 'sol ring')).toBe(1);
    expect(findMainboardRow(d, 'Negate')).toBe(-1);
  });
});
