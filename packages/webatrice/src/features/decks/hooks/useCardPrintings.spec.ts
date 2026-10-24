import { renderHook, waitFor } from '@testing-library/react';

import { fetchAllPrintings, lookupCard } from '@app/services';

import { emptyPriceLookup, fetchPricesForCards } from '../pricing';
import { useCardPrintings } from './useCardPrintings';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  fetchAllPrintings: vi.fn(),
  lookupCard: vi.fn(),
}));
vi.mock('../pricing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../pricing')>()),
  fetchPricesForCards: vi.fn(),
}));

describe('useCardPrintings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads nothing without a card', () => {
    const { result } = renderHook(() => useCardPrintings(undefined));
    expect(result.current.loading).toBe(false);
    expect(fetchAllPrintings).not.toHaveBeenCalled();
  });

  it('lists every Scryfall printing, then prices the ones with an id', async () => {
    vi.mocked(fetchAllPrintings).mockResolvedValue([
      { set: 'lea', collectorNumber: '161', scryfallId: 'id-lea' },
      { set: 'm11', collectorNumber: '149' },
    ]);
    const prices = emptyPriceLookup();
    prices.byId.set('id-lea', { usd: 400, tcgplayer: null });
    vi.mocked(fetchPricesForCards).mockResolvedValue(prices);

    const { result } = renderHook(() => useCardPrintings('Lightning Bolt'));

    await waitFor(() => expect(result.current.prices.byId.get('id-lea')?.usd).toBe(400));
    expect(result.current.printings.map((p) => p.set)).toEqual(['lea', 'm11']);
    expect(result.current.loading).toBe(false);
    expect(fetchPricesForCards).toHaveBeenCalledWith([{ scryfallId: 'id-lea', name: 'Lightning Bolt' }]);
  });

  it('falls back to the catalog printings when Scryfall has none', async () => {
    vi.mocked(fetchAllPrintings).mockResolvedValue([]);
    vi.mocked(lookupCard).mockResolvedValue({
      found: true, source: 'dexie', name: 'Custom', printings: [{ set: 'cus', collectorNumber: '1' }],
    });

    const { result } = renderHook(() => useCardPrintings('Custom'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.printings).toEqual([{ set: 'cus', collectorNumber: '1' }]);
    expect(fetchPricesForCards).not.toHaveBeenCalled();
  });

  it('reports a failure', async () => {
    vi.mocked(fetchAllPrintings).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCardPrintings('X'));
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.loading).toBe(false);
  });

  it('derives the canonical name from loaded printings without a second lookup', async () => {
    vi.mocked(fetchAllPrintings).mockResolvedValue([
      { name: 'Lightning Bolt', scryfallId: 'id-lea' },
    ]);
    vi.mocked(fetchPricesForCards).mockResolvedValue(emptyPriceLookup());
    const { result } = renderHook(() => useCardPrintings('lightning bolt'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canonicalName).toBe('Lightning Bolt');
    expect(lookupCard).not.toHaveBeenCalled();
  });

  it('aborts the abandoned lookup when the card changes', () => {
    vi.mocked(fetchAllPrintings).mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ name }) => useCardPrintings(name), {
      initialProps: { name: 'Lightning Bolt' },
    });
    const firstSignal = vi.mocked(fetchAllPrintings).mock.calls[0]?.[1];

    rerender({ name: 'Opt' });

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(true);
    expect(fetchAllPrintings).toHaveBeenLastCalledWith('Opt', expect.any(AbortSignal));
  });
});
