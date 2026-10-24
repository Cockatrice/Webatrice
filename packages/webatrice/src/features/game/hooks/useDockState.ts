import { useCallback, useEffect, useState } from 'react';

export type DockTab = 'log' | 'players' | 'spectators';

export interface DockState {
  collapsed: boolean;
  tab: DockTab;
}

const STORAGE_KEY = 'webatrice.gameDock';
const DEFAULT_STATE: DockState = { collapsed: false, tab: 'log' };
const TABS: readonly DockTab[] = ['log', 'players', 'spectators'];

export function parseDockState(raw: string | null | undefined): DockState {
  if (!raw) {
    return DEFAULT_STATE;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_STATE;
    }
    const { collapsed, tab } = parsed as Partial<Record<keyof DockState, unknown>>;
    return {
      collapsed: collapsed === true,
      tab: TABS.includes(tab as DockTab) ? (tab as DockTab) : DEFAULT_STATE.tab,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function readPersisted(): DockState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }
  try {
    return parseDockState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_STATE;
  }
}

export function useDockState(): DockState & {
  setCollapsed: (collapsed: boolean) => void;
  setTab: (tab: DockTab) => void;
  } {
  const [state, setState] = useState<DockState>(readPersisted);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      return;
    }
  }, [state]);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => (prev.collapsed === collapsed ? prev : { ...prev, collapsed }));
  }, []);
  const setTab = useCallback((tab: DockTab) => {
    setState((prev) => (prev.tab === tab && !prev.collapsed ? prev : { collapsed: false, tab }));
  }, []);

  return { ...state, setCollapsed, setTab };
}
