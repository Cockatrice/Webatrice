import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  CardDataSettingsDTO,
  dexieService,
  parseCod,
  refreshCardDataPreferences,
} from '@app/services';
import {
  applyDeckCardDataRefresh,
  hydrateDeck,
  type DeckCardDataRefresh,
} from '../../../../src/features/decks/hydrate';
import { serializeDeckForSave } from '../../../../src/features/decks/deckPersistence';

const row = {
  name: 'Opt', quantity: 1, category: 'main' as const,
  set: 'xln', collectorNumber: '065', scryfallId: 'saved-id',
};

beforeEach(async () => {
  vi.useRealTimers();
  await Promise.all([
    dexieService.cards.clear(),
    dexieService.sets.clear(),
    dexieService.setPreferences.clear(),
    dexieService.cardDataSettings.clear(),
    dexieService.scryfallCache.clear(),
  ]);
  await dexieService.cards.put({
    name: { value: 'Opt' },
    set: [
      { value: 'XLN', num: '65', uuid: 'saved-id' },
      { value: 'PIN', num: '1', uuid: 'pin-a' },
      { value: 'ALT', num: '2', uuid: 'pin-b' },
    ],
  });
  await CardDataSettingsDTO.setCardOverride('Opt', 'pin-a');
  await refreshCardDataPreferences();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    data: [{ name: 'Opt', id: 'saved-id', set: 'xln', collector_number: '65' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('keeps an explicit deck printing through pin changes, hydration refresh, and save', async () => {
  const parsed = { name: 'Pinned', format: 'modern', meta: { v: 1 as const, updatedAt: '' }, cards: [row] };
  await dexieService.scryfallCache.put({
    found: true, source: 'scryfall', name: 'Opt', fetchedAt: 0,
    printings: [{ set: 'XLN', collectorNumber: '65', scryfallId: 'saved-id' }],
  });
  let firstRefresh: Promise<DeckCardDataRefresh> | undefined;
  const deck = await hydrateDeck(parsed, undefined, (refresh) => {
    firstRefresh = refresh;
  });
  expect(deck.cards[0]).toMatchObject(row);
  expect((await firstRefresh)?.[0].lookup).toMatchObject({ pinnedPrintingId: 'pin-a' });

  await CardDataSettingsDTO.setCardOverride('Opt', 'pin-b');
  await refreshCardDataPreferences();
  await dexieService.scryfallCache.update('Opt', { fetchedAt: 0 });
  let secondRefresh: Promise<DeckCardDataRefresh> | undefined;
  const rehydrated = await hydrateDeck(parsed, undefined, (refresh) => {
    secondRefresh = refresh;
  });
  const refreshed = applyDeckCardDataRefresh(deck, await secondRefresh!);

  expect(rehydrated.cards[0]).toMatchObject(row);
  expect(refreshed.cards[0]).toMatchObject(row);
  expect((await secondRefresh)?.[0].lookup).toMatchObject({ pinnedPrintingId: 'pin-b' });
  expect(parseCod(serializeDeckForSave(refreshed)).cards[0]).toMatchObject(row);
});
