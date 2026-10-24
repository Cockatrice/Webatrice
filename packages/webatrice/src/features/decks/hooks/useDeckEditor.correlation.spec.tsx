import { act, renderHook, waitFor } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@cockatrice/datatrice';
import { endSession } from '@app/services/session';
import { rootReducerMap, type RootState } from '@app/store';
import { connectedState, createMockWebClient } from '../../../__test-utils__';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { emptyCod } from '@app/services';
import { hydrateDeck } from '../hydrate';
import { clearDeckEditorCache } from '../deckEditorCache';
import { useDeckEditor } from './useDeckEditor';
import type { HydratedDeck } from '../types';

vi.mock('../hydrate', async (original) => ({
  ...await original<typeof import('../hydrate')>(), hydrateDeck: vi.fn(),
}));
const hydrated = (name: string): HydratedDeck => ({ name, cards: [], format: 'modern', meta: { v: 1, updatedAt: 'x' } });
function setup() {
  const webClient = createMockWebClient();
  const { Wrapper, store } = makeReduxWebClientHookWrapper<RootState>({
    reducer: combineReducers(rootReducerMap), preloadedState: connectedState as RootState, webClient,
  });
  const RoutedWrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter><Wrapper>{children}</Wrapper></MemoryRouter>
  );
  const hook = renderHook(({ id }) => useDeckEditor(id), { wrapper: RoutedWrapper, initialProps: { id: 7 } });
  const requestId = () => vi.mocked(webClient.request.session.deckDownload).mock.calls.at(-1)![1];
  const success = (id: number, name: string, request = requestId()) => {
    act(() => store.dispatch(server.Actions.deckDownloaded({ deckId: id, deck: emptyCod(name, 'modern'), requestId: request })));
  };
  return { ...hook, Wrapper: RoutedWrapper, store, webClient, requestId, success };
}
beforeEach(() => {
  clearDeckEditorCache();
  vi.mocked(hydrateDeck).mockImplementation(async (deck) => hydrated(deck.name));
});

it('ignores another download of the same deck and consumes its own outcome only once', async () => {
  const ctx = setup();
  act(() => ctx.store.dispatch(server.Actions.deckDownloadFailed({ deckId: 7, responseCode: 3, requestId: 'background' })));
  expect(ctx.result.current.notFound).toBe(false);
  ctx.success(7, 'Background', 'background');
  expect(hydrateDeck).not.toHaveBeenCalled();
  ctx.success(7, 'Current');
  await waitFor(() => expect(ctx.result.current.deck?.name).toBe('Current'));
  act(() => ctx.store.dispatch(server.Actions.deckDownloadFailed({ deckId: 7, responseCode: 3, requestId: ctx.requestId() })));
  ctx.success(7, 'Duplicate');
  expect(ctx.result.current.notFound).toBe(false);
  expect(ctx.result.current.deck?.name).toBe('Current');
});

it('does not overwrite a new deck when old hydration completes after a route change', async () => {
  const ctx = setup();
  let resolve!: (deck: HydratedDeck) => void;
  vi.mocked(hydrateDeck).mockImplementationOnce(() => new Promise((done) => {
    resolve = done;
  }));
  ctx.success(7, 'Old');
  ctx.rerender({ id: 8 });
  ctx.success(8, 'New');
  await waitFor(() => expect(ctx.result.current.deck?.name).toBe('New'));
  await act(async () => resolve(hydrated('Old')));
  expect(ctx.result.current.deck?.name).toBe('New');
  ctx.unmount();
  const reopened = renderHook(() => useDeckEditor(7), { wrapper: ctx.Wrapper });
  expect(reopened.result.current.deck).toBeNull();
});

it('ignores hydration errors from a superseded request', async () => {
  const ctx = setup();
  let reject!: (reason: Error) => void;
  vi.mocked(hydrateDeck).mockImplementationOnce(() => new Promise((_done, fail) => {
    reject = fail;
  }));
  ctx.success(7, 'Old');
  ctx.rerender({ id: 8 });
  ctx.success(8, 'New');
  await waitFor(() => expect(ctx.result.current.deck?.name).toBe('New'));
  await act(async () => reject(new Error('old lookup failed')));
  expect(ctx.result.current.notFound).toBe(false);
  expect(ctx.result.current.deck?.name).toBe('New');
});

it('drops in-flight hydration and module cache on session end', async () => {
  const ctx = setup();
  let resolve!: (deck: HydratedDeck) => void;
  vi.mocked(hydrateDeck).mockImplementationOnce(() => new Promise((done) => {
    resolve = done;
  }));
  ctx.success(7, 'Old session');
  act(() => endSession());
  await act(async () => resolve(hydrated('Old session')));
  expect(ctx.result.current.deck).toBeNull();
  ctx.unmount();
  const reopened = renderHook(() => useDeckEditor(7), { wrapper: ctx.Wrapper });
  expect(reopened.result.current.deck).toBeNull();
});

it('clears an already populated cache at a session boundary', async () => {
  const ctx = setup();
  ctx.success(7, 'Cached');
  await waitFor(() => expect(ctx.result.current.deck?.name).toBe('Cached'));
  ctx.unmount();
  act(() => endSession());
  const reopened = renderHook(() => useDeckEditor(7), { wrapper: ctx.Wrapper });
  expect(reopened.result.current.deck).toBeNull();
});
