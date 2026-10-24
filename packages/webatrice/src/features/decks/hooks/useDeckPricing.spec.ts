import { renderHook, waitFor } from '@testing-library/react';

import { emptyPriceLookup, fetchPricesForCards, type PriceLookup } from '../pricing';
import type { HydratedDeck } from '../types';
import { deckPriceKey, useDeckPricing } from './useDeckPricing';

vi.mock('../pricing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../pricing')>()),
  fetchPricesForCards: vi.fn(),
}));

function deck(cards: HydratedDeck['cards']): HydratedDeck {
  return { name: 'D', meta: { v: 1, updatedAt: 'x' }, format: 'modern', cards };
}

const bolt = { name: 'Lightning Bolt', quantity: 4, category: 'main' as const, lookupSource: 'scryfall' as const };
const sol = { ...bolt, name: 'Sol Ring', quantity: 1, scryfallId: 'id-sol' };

function priced(): PriceLookup {
  const lookup = emptyPriceLookup();
  lookup.byName.set('lightning bolt', { usd: 2, tcgplayer: null });
  return lookup;
}

describe('deckPriceKey', () => {
  it('fingerprints printings and bare names, ignoring quantity and order', () => {
    expect(deckPriceKey(deck([bolt, sol]))).toBe('id:id-sol|name:lightning bolt');
    expect(deckPriceKey(deck([{ ...sol, quantity: 9 }, { ...bolt, quantity: 1 }]))).toBe('id:id-sol|name:lightning bolt');
    expect(deckPriceKey(null)).toBe('');
  });
});

describe('useDeckPricing', () => {
  it('streams partial prices, then persists the settled total and missing count', async () => {
    vi.mocked(fetchPricesForCards).mockImplementation(async (_cards, onProgress) => {
      onProgress?.(priced());
      return priced();
    });
    const persist = vi.fn();
    const d = deck([bolt, sol]);

    const { result } = renderHook(() => useDeckPricing(d, persist));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.prices.byName.get('lightning bolt')?.usd).toBe(2);
    expect(persist).toHaveBeenLastCalledWith(8, 1);
  });

  it('does not refetch for a quantity-only change', async () => {
    vi.mocked(fetchPricesForCards).mockImplementation(async (_cards, onProgress) => {
      onProgress?.(priced());
      return priced();
    });
    const persist = vi.fn();
    const { rerender } = renderHook(({ d }) => useDeckPricing(d, persist), {
      initialProps: { d: deck([bolt]) },
    });
    await waitFor(() => expect(persist).toHaveBeenCalled());

    rerender({ d: deck([{ ...bolt, quantity: 1 }]) });
    await waitFor(() => expect(persist).toHaveBeenLastCalledWith(2, undefined));
    expect(fetchPricesForCards).toHaveBeenCalledTimes(1);
  });

  it('settles without prices when the fetch fails', async () => {
    vi.mocked(fetchPricesForCards).mockRejectedValue(new Error('offline'));
    const persist = vi.fn();
    const { result } = renderHook(() => useDeckPricing(deck([bolt]), persist));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(persist).toHaveBeenLastCalledWith(undefined, 4);
  });
});
