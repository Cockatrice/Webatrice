import { act, renderHook } from '@testing-library/react';

import { parseDockState, useDockState } from './useDockState';

describe('parseDockState', () => {
  it('falls back to an open log tab for missing or malformed values', () => {
    expect(parseDockState(null)).toEqual({ collapsed: false, tab: 'log' });
    expect(parseDockState('nope')).toEqual({ collapsed: false, tab: 'log' });
    expect(parseDockState('{"collapsed":"yes","tab":"other"}')).toEqual({ collapsed: false, tab: 'log' });
  });

  it('reads a stored collapsed flag and tab', () => {
    expect(parseDockState('{"collapsed":true,"tab":"players"}')).toEqual({ collapsed: true, tab: 'players' });
  });
});

describe('useDockState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists collapse and tab changes, and selecting a tab reopens a collapsed dock', () => {
    const { result } = renderHook(() => useDockState());
    act(() => result.current.setCollapsed(true));
    expect(result.current.collapsed).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('webatrice.gameDock')!)).toEqual({ collapsed: true, tab: 'log' });

    act(() => result.current.setTab('spectators'));
    expect(result.current).toMatchObject({ collapsed: false, tab: 'spectators' });

    const again = renderHook(() => useDockState());
    expect(again.result.current).toMatchObject({ collapsed: false, tab: 'spectators' });
  });
});
