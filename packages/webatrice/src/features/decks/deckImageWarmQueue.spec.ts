import { groupDeckCards } from './deckGrouping';
import { cancelImageWarmQueue, createImageWarmQueue, deckImageWarmUrls, settleImageWarmQueue } from './deckImageWarmQueue';
import type { DeckCard, HydratedDeck } from './types';

const card = (name: string, overrides: Partial<DeckCard> = {}): DeckCard => ({
  name, imageUri: `https://img/${name}`, quantity: 1, category: 'main', lookupSource: 'scryfall', ...overrides,
});

describe('deck image warm queue', () => {
  it('prioritizes commanders and the selected banner printing before the supplied group order', () => {
    const deck: HydratedDeck = {
      name: 'D', format: 'commander', meta: { v: 1, updatedAt: '' }, bannerCard: 'Banner', bannerCardProviderId: 'chosen',
      cards: [card('Zulu'), card('Leader', { isCommander: true }), card('Banner', { scryfallId: 'other' }),
        card('Banner', { scryfallId: 'chosen', imageUri: 'https://img/chosen' }), card('Alpha'),
        card('Partner', { isCommander: true })],
    };
    const groups = [{ label: 'Other' as const, indices: [4, 0, 2, 3, 1, 5] }];
    expect(deckImageWarmUrls(deck, groups)).toEqual([
      'https://img/Leader', 'https://img/Partner', 'https://img/chosen', 'https://img/Alpha', 'https://img/Zulu', 'https://img/Banner',
    ]);
  });

  it('retains the main-pane grouping order and existing preview URL normalization', () => {
    const deck: HydratedDeck = {
      name: 'D', format: 'standard', meta: { v: 1, updatedAt: '' },
      cards: [card('Land', { typeLine: 'Land' }), card('Spell', { typeLine: 'Instant' }),
        card('Creature', { typeLine: 'Creature', imageUri: 'https://cards.scryfall.io/small/front/a.jpg' })],
    };
    expect(deckImageWarmUrls(deck, groupDeckCards(deck.cards, false))).toEqual([
      'https://cards.scryfall.io/normal/front/a.jpg', 'https://img/Spell', 'https://img/Land',
    ]);
  });

  it('deduplicates and excludes warmed URLs without modifying its inputs', () => {
    const warmed = new Set(['a']);
    const urls = ['a', 'b', 'b', 'c'];
    expect(createImageWarmQueue(urls, warmed).active).toEqual(['b', 'c']);
    expect(urls).toEqual(['a', 'b', 'b', 'c']);
    expect([...warmed]).toEqual(['a']);
  });

  it('uses the existing plain-pane name order for a non-Magic deck', () => {
    const deck: HydratedDeck = {
      name: 'D', format: 'custom', meta: { v: 1, updatedAt: '' },
      cards: [card('Alpha', { typeLine: 'Land' }), card('Zulu', { typeLine: 'Creature' })],
    };
    expect(deckImageWarmUrls(deck, groupDeckCards(deck.cards, false))).toEqual(['https://img/Alpha', 'https://img/Zulu']);
  });

  it('starts at most six loads and releases exactly one slot on settlement', () => {
    const urls = Array.from({ length: 10 }, (_, i) => String(i));
    const queue = createImageWarmQueue(urls, new Set());
    expect(queue.active).toEqual(urls.slice(0, 6));
    const next = settleImageWarmQueue(queue, '2');
    expect(next.active).toEqual(['0', '1', '3', '4', '5', '6']);
    expect(next.pending).toEqual(['7', '8', '9']);
    expect(queue.active).toEqual(urls.slice(0, 6));
    expect(settleImageWarmQueue(next, '2')).toBe(next);
  });

  it('never starts queued URLs after cancellation, including late completions', () => {
    const queue = createImageWarmQueue(Array.from({ length: 8 }, (_, i) => String(i)), new Set());
    const cancelled = cancelImageWarmQueue(queue);
    expect(cancelled.pending).toEqual([]);
    expect(cancelled.active).toEqual([]);
    expect(settleImageWarmQueue(cancelled, '0')).toBe(cancelled);
    expect(queue.pending).toEqual(['6', '7']);
  });
});
