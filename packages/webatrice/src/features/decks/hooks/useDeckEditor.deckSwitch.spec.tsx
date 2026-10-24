import { act, renderHook, waitFor } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';

import { rootReducerMap, type RootState } from '../../../store';
import { connectedState, createMockWebClient } from '../../../__test-utils__';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';

vi.mock('@app/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/services')>();
  return { ...actual,
    lookupCardsForHydration: vi.fn(async () => ({ lookups: new Map(), refreshed: Promise.resolve(new Map()) })),
    trackEvent: vi.fn(),
  };
});

import { emptyCod, parseCod, serializeCod } from '@app/services';
import { clearDeckEditorCache } from '../deckEditorCache';
import { useDeckEditor } from './useDeckEditor';

const reducer = combineReducers(rootReducerMap);
const DECK_A = 1;
const DECK_B = 2;

function setup(initialDeckId: number) {
  const webClient = createMockWebClient();
  const { Wrapper, store } = makeReduxWebClientHookWrapper({
    reducer: reducer as never,
    preloadedState: connectedState as Partial<RootState> as never,
    webClient,
  });
  const RoutedWrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter><Wrapper>{children}</Wrapper></MemoryRouter>
  );
  const hook = renderHook(({ deckId }) => useDeckEditor(deckId), {
    wrapper: RoutedWrapper,
    initialProps: { deckId: initialDeckId },
  });
  const download = async (deckId: number, name: string, format: string, cardName?: string) => {
    act(() => {
      const deck = cardName ? serializeCod({
        name, format, meta: { v: 1, updatedAt: 'x' }, cards: [{ name: cardName, quantity: 1, category: 'main' }],
      }) : emptyCod(name, format);
      store.dispatch(server.Actions.deckDownloaded({
        deckId, deck,
        requestId: vi.mocked(webClient.request.session.deckDownload).mock.calls.at(-1)![1],
      }));
    });
    await waitFor(() => expect(hook.result.current.deck?.name).toBe(name));
  };
  const uploads = () =>
    vi.mocked(webClient.request.session.deckUpdate).mock.calls.map(([deckId, deckList]) => ({ deckId, deckList }));
  return { ...hook, Wrapper: RoutedWrapper, download, uploads };
}

beforeEach(() => {
  clearDeckEditorCache();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useDeckEditor — switching deckId on a mounted editor', () => {
  it.each(['undo', 'redo'] as const)('cannot %s another deck after a cached switch', async (action) => {
    const { result, rerender, download, uploads } = setup(DECK_A);
    await download(DECK_A, 'Alpha', 'modern', 'Island');
    rerender({ deckId: DECK_B });
    await download(DECK_B, 'Bravo', 'standard', 'Mountain');
    act(() => result.current.incQuantity(0, 1));
    if (action === 'redo') {
      act(() => result.current.undo());
    }
    rerender({ deckId: DECK_A });
    act(() => result.current[action]());
    expect(result.current.deck?.cards.map((card) => card.name)).toEqual(['Island']);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.incQuantity(0, 1));
    act(() => result.current.flushSave());

    rerender({ deckId: DECK_B });
    act(() => {
      result.current.undo(); result.current.redo();
    });
    expect(result.current.deck?.cards.map((card) => card.name)).toEqual(['Mountain']);
    act(() => result.current.incQuantity(0, 1));
    act(() => result.current.flushSave());
    expect(uploads().some(({ deckId }) => deckId === DECK_A)).toBe(true);
    expect(uploads().some(({ deckId }) => deckId === DECK_B)).toBe(true);
    for (const { deckId, deckList } of uploads()) {
      expect(parseCod(deckList).cards.map((card) => card.name)).toEqual([deckId === DECK_A ? 'Island' : 'Mountain']);
    }
  });

  it('re-seeds from the cache and autosaves the open deck, not the previous one', async () => {
    const { result, rerender, download, uploads } = setup(DECK_A);
    await download(DECK_A, 'Alpha', 'modern');

    rerender({ deckId: DECK_B });
    await download(DECK_B, 'Bravo', 'standard');

    rerender({ deckId: DECK_A });
    expect(result.current.deck?.name).toBe('Alpha');
    expect(result.current.deck?.format).toBe('modern');

    act(() => result.current.setDescription('edited'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(uploads()).toHaveLength(1);
    expect(uploads()[0].deckId).toBe(DECK_A);
    expect(uploads()[0].deckList).toContain('<deckname>Alpha</deckname>');
    expect(uploads()[0].deckList).toContain('modern');
    expect(uploads()[0].deckList).not.toContain('standard');
  });

  it('does not mirror the previous deck into the next deck\'s cache entry', async () => {
    const { rerender, unmount, Wrapper, download } = setup(DECK_A);
    await download(DECK_A, 'Alpha', 'modern');
    rerender({ deckId: DECK_B });
    await download(DECK_B, 'Bravo', 'standard');
    rerender({ deckId: DECK_A });
    unmount();

    const { result } = renderHook(() => useDeckEditor(DECK_A), { wrapper: Wrapper });

    expect(result.current.deck?.name).toBe('Alpha');
    expect(result.current.deck?.format).toBe('modern');
  });

  it('clears the previous deck while an uncached deck downloads', async () => {
    const { result, rerender, download } = setup(DECK_A);
    await download(DECK_A, 'Alpha', 'modern');

    rerender({ deckId: DECK_B });

    expect(result.current.deck).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('flushes a pending edit to the deck it was made on when the deckId changes', async () => {
    const { result, rerender, download, uploads } = setup(DECK_A);
    await download(DECK_A, 'Alpha', 'modern');
    rerender({ deckId: DECK_B });
    await download(DECK_B, 'Bravo', 'standard');
    rerender({ deckId: DECK_A });

    act(() => result.current.setDescription('edited'));
    rerender({ deckId: DECK_B });

    expect(uploads()).toHaveLength(1);
    expect(uploads()[0].deckId).toBe(DECK_A);
    expect(uploads()[0].deckList).toContain('<deckname>Alpha</deckname>');
  });
});
