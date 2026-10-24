import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { combineReducers } from '@reduxjs/toolkit';
import { server } from '@cockatrice/datatrice';

import { rootReducerMap, type RootState } from '@app/store';
import { connectedState, createMockWebClient } from '../../../__test-utils__';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';
import { clearDeckEditorCache, getCachedDeck, setCachedDeck } from '../deckEditorCache';
import { deckSaveSignature } from '../deckPersistence';
import type { HydratedDeck } from '../types';
import { useDeckEditor } from './useDeckEditor';

const deck: HydratedDeck = {
  name: 'Cached', format: 'modern', meta: { v: 1, updatedAt: 'x' },
  cards: [{ name: 'Island', quantity: 1, category: 'main', lookupSource: 'unknown' }],
};

beforeEach(() => {
  clearDeckEditorCache();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('useDeckEditor — save settlement across unmount', () => {
  it.each(['success', 'failure', 'pending'] as const)('reopens a cached deck with its %s save state', (outcome) => {
    const webClient = createMockWebClient();
    const { Wrapper, store } = makeReduxWebClientHookWrapper<RootState>({
      reducer: combineReducers(rootReducerMap), preloadedState: connectedState as RootState, webClient,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode><MemoryRouter><Wrapper>{children}</Wrapper></MemoryRouter></StrictMode>
    );
    const response = (error: { responseCode: number } | null) => {
      const calls = vi.mocked(webClient.request.session.deckUpdate).mock.calls;
      act(() => {
        store.dispatch(error ? server.Actions.deckUpdateFailed({ deckId: 7, ...error }) : server.Actions.deckUpdated({ deckId: 7 }));
        calls.at(-1)![4]!(error);
      });
    };
    setCachedDeck(7, { deck, savedSignature: deckSaveSignature(deck) });
    const editor = renderHook(() => useDeckEditor(7), { wrapper });
    act(() => editor.result.current.incQuantity(0, 1));
    const edited = editor.result.current.deck!;
    editor.unmount();
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    if (outcome !== 'pending') {
      response(outcome === 'success' ? null : { responseCode: 1 });
    }

    const reopened = renderHook(() => useDeckEditor(7), { wrapper });
    expect(reopened.result.current.saveState).toBe({ success: 'saved', failure: 'failed', pending: 'saving' }[outcome]);
    expect(reopened.result.current.deck?.cards[0].quantity).toBe(2);
    expect(webClient.request.session.deckDownload).not.toHaveBeenCalled();
    if (outcome === 'failure') {
      act(() => reopened.result.current.retrySave());
      act(() => reopened.result.current.flushSave());
      expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(2);
    }
    if (outcome !== 'success') {
      response(null);
    }
    expect(reopened.result.current.saveState).toBe('saved');
    expect(getCachedDeck(7)?.savedSignature).toBe(deckSaveSignature(edited));
  });
});
