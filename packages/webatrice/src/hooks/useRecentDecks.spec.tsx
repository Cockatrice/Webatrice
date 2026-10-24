import { vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';

import { makeUser } from '@cockatrice/datatrice/testing';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { recordRecentDeck, recentDeckSnapshot, resetRecentDecksCache, type RecentDeckSource } from '@app/services';

const hoisted = vi.hoisted(() => ({ endpoint: 'ws://localhost:4748' as string | null }));

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: () => ({ socket: { connectedEndpoint: hoisted.endpoint } }) };
});

import { useRecentDecks, useRecordRecentDeck } from './useRecentDecks';

const HOST = 'ws://localhost:4748';
const deck = (name: string): RecentDeckSource => ({ name, format: 'modern', meta: {}, cards: [] });

function wrapperFor(userName: string | null) {
  const state = {
    user: userName ? makeUser({ name: userName }) : null,
    status: { state: userName ? WebsocketTypes.StatusEnum.LOGGED_IN : WebsocketTypes.StatusEnum.DISCONNECTED },
  };
  const store = configureStore({ reducer: { server: (s = state) => s } });
  return ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
}

beforeEach(() => {
  hoisted.endpoint = 'ws://localhost:4748';
  window.localStorage.clear();
  resetRecentDecksCache();
});

describe('useRecentDecks', () => {
  it('shows only the decks of this server and account', () => {
    recordRecentDeck(recentDeckSnapshot(HOST, 'bob', 1, deck('Bob deck'), 1));
    recordRecentDeck(recentDeckSnapshot('ws://other.net:4748', 'alice', 3, deck('Other server'), 3));
    recordRecentDeck(recentDeckSnapshot(HOST, 'alice', 2, deck('Alice deck'), 2));
    const { result } = renderHook(() => useRecentDecks(), { wrapper: wrapperFor('alice') });
    expect(result.current.map((d) => d.name)).toEqual(['Alice deck']);
  });

  it('is empty when signed out', () => {
    recordRecentDeck(recentDeckSnapshot(HOST, 'alice', 2, deck('Alice deck'), 2));
    const { result } = renderHook(() => useRecentDecks(), { wrapper: wrapperFor(null) });
    expect(result.current).toEqual([]);
  });
});

describe('useRecordRecentDeck', () => {
  it('records the open deck under this server and follows renames', () => {
    const wrapper = wrapperFor('alice');
    const list = renderHook(() => useRecentDecks(), { wrapper });
    const { rerender } = renderHook(({ d }) => useRecordRecentDeck(5, d), { wrapper, initialProps: { d: deck('First') } });
    expect(list.result.current.map((d) => [d.scope, d.deckId, d.name])).toEqual([[HOST, 5, 'First']]);
    act(() => rerender({ d: deck('Renamed') }));
    expect(list.result.current.map((d) => [d.deckId, d.name])).toEqual([[5, 'Renamed']]);
  });

  it('ignores drafts, decks still loading and sessions without a server endpoint', () => {
    const wrapper = wrapperFor('alice');
    renderHook(() => useRecordRecentDeck(null, deck('Draft')), { wrapper });
    renderHook(() => useRecordRecentDeck(6, null), { wrapper });
    hoisted.endpoint = null;
    renderHook(() => useRecordRecentDeck(7, deck('No endpoint')), { wrapper });
    expect(window.localStorage.getItem('webatrice.recentDecks')).toBeNull();
  });
});
