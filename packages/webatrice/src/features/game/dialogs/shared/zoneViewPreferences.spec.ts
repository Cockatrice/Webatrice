import { renderHook, act } from '@testing-library/react';

import { useZoneViewPreferences } from './useZoneViewPreferences';
import {
  DEFAULT_ZONE_VIEW_PREFERENCES,
  readShuffleOnClose,
  readZoneViewPreferences,
  writeShuffleOnClose,
  writeZoneViewPreferences,
} from './zoneViewPreferences';

const KEY = 'webatrice.testView';

afterEach(() => {
  window.localStorage.clear();
});

describe('zone view preferences', () => {
  it('defaults to desktop\'s By Type, By Name, with pile view on', () => {
    expect(readZoneViewPreferences(KEY)).toEqual({ groupBy: 'type', sortBy: 'name', pileView: true });
    expect(DEFAULT_ZONE_VIEW_PREFERENCES).toEqual(readZoneViewPreferences(KEY));
  });

  it('round-trips each choice under the view\'s own keys', () => {
    writeZoneViewPreferences(KEY, { groupBy: 'color', sortBy: 'pt', pileView: false });
    expect(window.localStorage.getItem(`${KEY}GroupBy`)).toBe('color');
    expect(window.localStorage.getItem(`${KEY}SortBy`)).toBe('pt');
    expect(window.localStorage.getItem(`${KEY}PileView`)).toBe('0');
    expect(readZoneViewPreferences(KEY)).toEqual({ groupBy: 'color', sortBy: 'pt', pileView: false });
    expect(readZoneViewPreferences('webatrice.otherView')).toEqual(DEFAULT_ZONE_VIEW_PREFERENCES);
  });

  it('falls back per choice on an unknown value', () => {
    window.localStorage.setItem(`${KEY}GroupBy`, 'rarity');
    window.localStorage.setItem(`${KEY}SortBy`, 'set');
    expect(readZoneViewPreferences(KEY)).toEqual({ groupBy: 'type', sortBy: 'set', pileView: true });
  });

  it('remembers "shuffle when closing", on by default', () => {
    expect(readShuffleOnClose()).toBe(true);
    writeShuffleOnClose(false);
    expect(readShuffleOnClose()).toBe(false);
  });

  it('holds and stores the choices through the hook', () => {
    window.localStorage.setItem(`${KEY}SortBy`, 'cmc');
    const { result } = renderHook(() => useZoneViewPreferences(KEY));
    expect(result.current).toMatchObject({ groupBy: 'type', sortBy: 'cmc', pileView: true });

    act(() => result.current.setGroupBy('none'));
    act(() => result.current.setPileView(false));
    expect(result.current).toMatchObject({ groupBy: 'none', sortBy: 'cmc', pileView: false });
    expect(readZoneViewPreferences(KEY)).toEqual({ groupBy: 'none', sortBy: 'cmc', pileView: false });
  });

  it('preserves choices saved by another open view sharing the same prefix', () => {
    const storageKey = 'webatrice.searchLibrary';
    const { result: first } = renderHook(() => useZoneViewPreferences(storageKey));
    const { result: second } = renderHook(() => useZoneViewPreferences(storageKey));

    act(() => first.current.setSortBy('cmc'));
    expect(window.localStorage.getItem(`${storageKey}SortBy`)).toBe('cmc');

    act(() => second.current.setGroupBy('color'));
    expect(window.localStorage.getItem(`${storageKey}SortBy`)).toBe('cmc');
    expect(window.localStorage.getItem(`${storageKey}GroupBy`)).toBe('color');

    act(() => first.current.setPileView(false));
    expect(readZoneViewPreferences(storageKey)).toEqual({ groupBy: 'color', sortBy: 'cmc', pileView: false });
  });
});
