import { renderHook, waitFor } from '@testing-library/react';

import { getFormatRules, lookupCardsCached, type LookupResult } from '@app/services';

import type { HydratedDeck } from '../types';
import { useDeckLegality } from './useDeckLegality';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCardsCached: vi.fn(),
  getFormatRules: vi.fn(),
}));

function found(name: string, legalities?: Record<string, string>): LookupResult {
  return { found: true, source: 'scryfall', name, printings: [], legalities };
}

function deck(format: string, cards: [string, number][]): HydratedDeck {
  return {
    name: 'D',
    meta: { v: 1, updatedAt: 'x' },
    format,
    cards: cards.map(([name, quantity]) => ({ name, quantity, category: 'main', lookupSource: 'scryfall' })),
  };
}

beforeEach(() => {
  vi.mocked(lookupCardsCached).mockImplementation(async (names: string[]) => new Map(names.map((n) => [
    n,
    n === 'Sol Ring' ? found(n, { modern: 'banned' }) : found(n, { modern: 'legal' }),
  ])));
  vi.mocked(getFormatRules).mockResolvedValue({
    formatName: 'modern',
    allowedCounts: [{ max: '4', label: 'legal' }, { max: '0', label: 'banned' }],
  });
});

describe('useDeckLegality', () => {
  it('flags nothing while loading, then checks every row against the format rules', async () => {
    const { result } = renderHook(() => useDeckLegality(deck('modern', [['Lightning Bolt', 4], ['Sol Ring', 1]])));
    expect(result.current.loading).toBe(true);
    expect(result.current.illegalCount).toBe(0);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.map((r) => r.status)).toEqual(['legal', 'illegal']);
    expect(result.current.status).toBe('illegal');
    expect(getFormatRules).toHaveBeenCalledWith('modern');
  });

  it('re-checks a quantity change without another lookup, and a format change with new rules', async () => {
    const { result, rerender } = renderHook(({ d }) => useDeckLegality(d), {
      initialProps: { d: deck('modern', [['Lightning Bolt', 4]]) },
    });
    await waitFor(() => expect(result.current.status).toBe('legal'));

    rerender({ d: deck('modern', [['Lightning Bolt', 5]]) });
    expect(result.current.rows[0]).toEqual({ status: 'illegal', reason: 'tooMany', max: 4 });
    expect(lookupCardsCached).toHaveBeenCalledTimes(1);

    vi.mocked(getFormatRules).mockResolvedValue(undefined);
    rerender({ d: deck('Cube', [['Lightning Bolt', 5]]) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe('unavailable');
  });

  it('reports cards as unchecked when the lookup fails', async () => {
    vi.mocked(lookupCardsCached).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeckLegality(deck('modern', [['Lightning Bolt', 1]])));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0].status).toBe('unknown');
    expect(result.current.status).toBe('unavailable');
  });

  it('aborts the abandoned lookup when the deck changes', () => {
    vi.mocked(lookupCardsCached).mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ d }) => useDeckLegality(d), {
      initialProps: { d: deck('modern', [['Lightning Bolt', 1]]) },
    });
    const firstSignal = vi.mocked(lookupCardsCached).mock.calls[0]?.[1];

    rerender({ d: deck('modern', [['Opt', 1]]) });

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(true);
    expect(lookupCardsCached).toHaveBeenLastCalledWith(['Opt'], expect.any(AbortSignal), true);
  });
});
