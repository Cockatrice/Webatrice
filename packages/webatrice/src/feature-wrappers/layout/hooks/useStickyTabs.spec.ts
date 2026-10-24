import { act, renderHook } from '@testing-library/react';

import type { Tab } from '../topBarTabs';

const STORAGE_KEY = 'webatrice.stickyTabs';

const decks: Tab = { key: 'decks', type: 'decks', titleKey: 'TopBar.tab.myDecks', route: '/decks', closeable: true };
const deck: Tab = {
  key: 'deck:4', type: 'deck', titleKey: 'TopBar.tab.deck', titleParams: { id: '4' }, route: '/deck/4', closeable: true,
};
const bob: Tab = { key: 'player:bob', type: 'player', title: 'bob', route: '/player/bob', closeable: true };

async function loadModule() {
  vi.resetModules();
  return import('./useStickyTabs');
}

const persist = (value: unknown) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
const persisted = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');

describe('useStickyTabs', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts empty when nothing is saved', async () => {
    const { useStickyTabs } = await loadModule();

    const { result } = renderHook(() => useStickyTabs());

    expect(result.current[0]).toEqual([]);
  });

  it('restores saved tabs, dropping the ones it cannot show', async () => {
    persist([decks, { key: 'x' }, { ...deck, type: 'bogus' }, { ...deck, titleKey: undefined }, deck, bob]);
    const { useStickyTabs } = await loadModule();

    const { result } = renderHook(() => useStickyTabs());

    expect(result.current[0]).toEqual([decks, deck]);
  });

  it('retitles a tab saved with a translated title from its route', async () => {
    persist([{ key: 'decks', type: 'decks', title: 'Meine Decks', route: '/decks', closeable: true }]);
    const { useStickyTabs } = await loadModule();

    const { result } = renderHook(() => useStickyTabs());

    expect(result.current[0]).toEqual([decks]);
  });

  it('keeps a pinned Shortcuts tab after a reload', async () => {
    const shortcuts: Tab = {
      key: 'shortcuts', type: 'shortcuts', titleKey: 'UserMenu.shortcuts', route: '/shortcuts', closeable: true,
    };
    const { useStickyTabs } = await loadModule();
    const writer = renderHook(() => useStickyTabs());
    act(() => writer.result.current[1](() => [shortcuts]));
    writer.unmount();

    const { useStickyTabs: useRestoredTabs } = await loadModule();
    const reader = renderHook(() => useRestoredTabs());

    expect(reader.result.current[0]).toEqual([shortcuts]);
  });

  it.each(['not json', '{"key":"decks"}'])('starts empty when the saved value is %s', async (raw) => {
    window.localStorage.setItem(STORAGE_KEY, raw);
    const { useStickyTabs } = await loadModule();

    const { result } = renderHook(() => useStickyTabs());

    expect(result.current[0]).toEqual([]);
  });

  it('shares an update with every reader and saves it without handlers', async () => {
    const { useStickyTabs } = await loadModule();
    const writer = renderHook(() => useStickyTabs());
    const reader = renderHook(() => useStickyTabs());

    act(() => writer.result.current[1](() => [{ ...deck, onClose: () => {} }]));

    expect(reader.result.current[0].map(({ key }) => key)).toEqual(['deck:4']);
    expect(persisted()).toEqual([deck]);
  });

  it('neither saves nor notifies when the updater returns the same list', async () => {
    persist([decks]);
    const { useStickyTabs } = await loadModule();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useStickyTabs();
    });
    const before = renders;

    act(() => result.current[1]((prev) => prev));

    expect(setItem).not.toHaveBeenCalled();
    expect(renders).toBe(before);
  });

  it('keeps the tabs for this session when storage refuses the write', async () => {
    const { useStickyTabs } = await loadModule();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useStickyTabs());

    act(() => result.current[1](() => [decks]));

    expect(result.current[0]).toEqual([decks]);
  });
});
