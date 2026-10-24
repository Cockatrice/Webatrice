import { act, renderHook } from '@testing-library/react';

import { searchCards } from '../search';
import { MAX_SUGGESTIONS, SUGGESTION_DEBOUNCE_MS, useQuickAddSuggestions } from './useQuickAddSuggestions';

vi.mock('../search', () => ({ searchCards: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);
  });
}

describe('useQuickAddSuggestions', () => {
  it('ignores queries shorter than two characters', async () => {
    const { result } = renderHook(() => useQuickAddSuggestions('s'));
    await settle();
    expect(searchCards).not.toHaveBeenCalled();
    expect(result.current).toEqual(expect.objectContaining({ suggestions: [], loading: false, highlight: -1 }));
  });

  it('debounces the lookup and highlights the first suggestion', async () => {
    vi.mocked(searchCards).mockResolvedValue([{ name: 'Sol Ring', source: 'scryfall' }]);
    const { result, rerender } = renderHook(({ q }) => useQuickAddSuggestions(q), { initialProps: { q: 'so' } });
    rerender({ q: 'sol' });
    expect(result.current.loading).toBe(true);

    await settle();

    expect(searchCards).toHaveBeenCalledTimes(1);
    expect(searchCards).toHaveBeenCalledWith('sol', MAX_SUGGESTIONS, expect.any(AbortSignal));
    expect(result.current.suggestions).toEqual([{ name: 'Sol Ring', source: 'scryfall' }]);
    expect(result.current.highlight).toBe(0);

    act(() => result.current.clear());
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.highlight).toBe(-1);
  });

  it('drops a response that arrives after a newer query was sent', async () => {
    let resolveFirst: (rows: Array<{ name: string; source: 'scryfall' }>) => void = () => {};
    vi.mocked(searchCards)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce([{ name: 'Sol Talisman', source: 'scryfall' }]);
    const { result, rerender } = renderHook(({ q }) => useQuickAddSuggestions(q), { initialProps: { q: 'sol r' } });
    await settle();
    rerender({ q: 'sol t' });
    await settle();

    await act(async () => resolveFirst([{ name: 'Sol Ring', source: 'scryfall' }]));
    expect(result.current.suggestions).toEqual([{ name: 'Sol Talisman', source: 'scryfall' }]);
  });

  it('aborts an in-flight lookup when the query changes', async () => {
    vi.mocked(searchCards)
      .mockImplementationOnce((_query, _limit, signal) => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }))
      .mockResolvedValueOnce([{ name: 'Sol Talisman', source: 'scryfall' }]);
    const { result, rerender } = renderHook(({ q }) => useQuickAddSuggestions(q), { initialProps: { q: 'sol r' } });
    await settle();
    const firstSignal = vi.mocked(searchCards).mock.calls[0]?.[2];

    rerender({ q: 'sol t' });

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(true);
    await settle();
    expect(result.current.suggestions).toEqual([{ name: 'Sol Talisman', source: 'scryfall' }]);
  });

  it('clears the list when the lookup fails', async () => {
    vi.mocked(searchCards).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useQuickAddSuggestions('sol'));
    await settle();
    expect(result.current).toEqual(expect.objectContaining({ suggestions: [], loading: false, highlight: -1 }));
  });
});
