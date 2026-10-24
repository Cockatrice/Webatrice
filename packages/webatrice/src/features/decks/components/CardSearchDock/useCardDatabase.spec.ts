import { act, renderHook } from '@testing-library/react';

import { searchScryfallPage, type ScryfallSearchPage } from '../../search';
import { SEARCH_DEBOUNCE_MS, useCardDatabase } from './useCardDatabase';

vi.mock('../../search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../search')>()),
  searchScryfallPage: vi.fn(),
}));

const page = (names: string[], nextPage: string | null = null): ScryfallSearchPage => ({
  cards: names.map((name) => ({ id: name, name })),
  total: names.length + (nextPage ? 100 : 0),
  nextPage,
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCardDatabase', () => {
  it('marks the previous results stale until the new query answers', async () => {
    vi.mocked(searchScryfallPage)
      .mockResolvedValueOnce(page(['Llanowar Elves']))
      .mockResolvedValueOnce(page(['Lightning Bolt']));
    const { result, rerender } = renderHook(({ q }) => useCardDatabase(q), { initialProps: { q: 'elves' } });

    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    expect(result.current).toMatchObject({ fresh: true, results: [{ name: 'Llanowar Elves' }] });

    rerender({ q: 'bolt' });
    expect(result.current).toMatchObject({ fresh: false, loading: true, results: [{ name: 'Llanowar Elves' }] });

    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    expect(result.current).toMatchObject({ fresh: true, loading: false, results: [{ name: 'Lightning Bolt' }] });
  });

  it('is current and empty for a blank query', () => {
    const { result } = renderHook(() => useCardDatabase('  '));
    expect(result.current).toMatchObject({ fresh: true, results: [], total: 0, hasMore: false });
    expect(searchScryfallPage).not.toHaveBeenCalled();
  });

  it('offers the next page only for the current query and appends it', async () => {
    const next = 'https://api.scryfall.com/cards/search?q=elf&page=2';
    vi.mocked(searchScryfallPage)
      .mockResolvedValueOnce(page(['Elvish Mystic'], next))
      .mockResolvedValueOnce(page(['Llanowar Elves']));
    const { result, rerender } = renderHook(({ q }) => useCardDatabase(q), { initialProps: { q: 'elf' } });
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));
    expect(result.current.hasMore).toBe(true);

    await act(async () => result.current.loadMore());
    expect(searchScryfallPage).toHaveBeenLastCalledWith(next, expect.anything());
    expect(result.current.results.map((c) => c.name)).toEqual(['Elvish Mystic', 'Llanowar Elves']);

    rerender({ q: 'elves' });
    expect(result.current.hasMore).toBe(false);
  });
});
