import type { LookupResult } from '@app/services';

import { applyDeckCardDataRefresh, assembleDeckCard } from './hydrate';
import { serializeDeckForSave } from './deckPersistence';

const ID = '0f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const lookup = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  found: true,
  source: 'dexie',
  name: 'Sol Ring',
  printings: [{ set: 'C21', collectorNumber: '263', scryfallId: 'other-id', imageUri: 'https://mirror/c21.jpg' }],
  ...overrides,
});

describe('assembleDeckCard image', () => {
  it.each([
    ['other-id', 'other-id', 'C21'],
    ['missing-id', undefined, undefined],
  ])('uses a pinned printing only when that printing is present', (pinnedPrintingId, scryfallId, set) => {
    const card = assembleDeckCard(
      { name: 'Sol Ring', quantity: 1, category: 'main' },
      lookup({ pinnedPrintingId }),
    );

    expect(card).toMatchObject({ name: 'Sol Ring', scryfallId, set });
  });

  it('keeps a saved printing through hydration, refresh, and serialization despite a different pin', () => {
    const row = {
      name: 'Sol Ring', quantity: 1, category: 'main' as const,
      set: 'c21', collectorNumber: '0263', scryfallId: 'other-id',
    };
    const card = assembleDeckCard(row, lookup({ pinnedPrintingId: 'missing-id' }));
    const deck = {
      name: 'Saved', meta: { v: 1 as const, updatedAt: '' }, format: 'commander', cards: [card],
    };
    const refreshed = applyDeckCardDataRefresh(deck, [{
      card,
      lookup: lookup({
        pinnedPrintingId: 'new-pin',
        printings: [{ set: 'NEW', collectorNumber: '1', scryfallId: 'new-pin', imageUri: 'https://img/new.jpg' }],
      }),
    }]);

    expect(refreshed.cards[0]).toMatchObject(row);
    expect(serializeDeckForSave(refreshed)).toContain('uuid="other-id"');
  });

  it('does not use a pin as the default when only a collector number was saved', () => {
    const card = assembleDeckCard(
      { name: 'Sol Ring', quantity: 1, category: 'main', collectorNumber: 'saved-only' },
      lookup({ pinnedPrintingId: 'other-id' }),
    );

    expect(card).toMatchObject({ collectorNumber: 'saved-only', set: undefined, scryfallId: undefined });
  });

  it('fills an unresolved default after refresh resolves its pin', () => {
    const row = { name: 'Sol Ring', quantity: 1, category: 'main' as const };
    const card = assembleDeckCard(row, lookup({ pinnedPrintingId: 'pin', printings: [] }));
    const deck = {
      name: 'Default', meta: { v: 1 as const, updatedAt: '' }, format: 'commander', cards: [card],
    };
    const refreshed = applyDeckCardDataRefresh(deck, [{
      card,
      lookup: lookup({
        pinnedPrintingId: 'pin',
        printings: [{ set: 'PIN', collectorNumber: '1', scryfallId: 'pin', imageUri: 'https://img/pin.jpg' }],
      }),
    }]);

    expect(refreshed.cards[0]).toMatchObject({
      set: 'PIN', collectorNumber: '1', scryfallId: 'pin', imageUri: 'https://img/pin.jpg',
    });
  });

  it('uses the chosen printing\'s image when the catalog knows it', () => {
    const card = assembleDeckCard({ name: 'Sol Ring', quantity: 1, category: 'main', scryfallId: 'other-id' }, lookup());
    expect(card.imageUri).toBe('https://mirror/c21.jpg');
  });

  it('loads a printing the catalog does not know by its Scryfall id', () => {
    const card = assembleDeckCard({ name: 'Sol Ring', quantity: 1, category: 'main', scryfallId: ID }, lookup());
    expect(card.imageUri).toBe(`https://api.scryfall.com/cards/${ID}?format=image&version=normal`);
  });

  it('retains the id fallback when a matching printing has no image metadata', () => {
    const card = assembleDeckCard(
      { name: 'Sol Ring', quantity: 1, category: 'main', scryfallId: ID },
      lookup({ printings: [{ scryfallId: ID }] }),
    );
    expect(card.imageUris).toEqual([`https://api.scryfall.com/cards/${ID}?format=image&version=normal`]);
  });

  it('uses the first preferred printing when the deck has no override', () => {
    const card = assembleDeckCard(
      { name: 'Sol Ring', quantity: 1, category: 'main' },
      lookup({
        printings: [
          { set: 'MPS', scryfallId: 'preferred', imageUri: 'https://img/preferred.jpg' },
          { set: 'C21', scryfallId: 'last', imageUri: 'https://img/last.jpg' },
        ],
      }),
    );

    expect(card).toMatchObject({ set: 'MPS', scryfallId: 'preferred', imageUri: 'https://img/preferred.jpg' });
  });

  it('keeps the selected printing image fallback chain', () => {
    const card = assembleDeckCard(
      { name: 'Sol Ring', quantity: 1, category: 'main' },
      lookup({
        printings: [{
          set: 'C21',
          imageUri: 'https://img/first.jpg',
          imageUris: ['https://img/first.jpg', 'https://img/second.jpg'],
        }],
      }),
    );

    expect(card.imageUris).toEqual(['https://img/first.jpg', 'https://img/second.jpg']);
  });
});
