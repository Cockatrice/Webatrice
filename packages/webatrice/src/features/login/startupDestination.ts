import { useEffect, useState } from 'react';
import { useLocation, type To } from 'react-router-dom';

import { useKnownHosts } from '@app/feature-widgets/known-hosts';
import { LoadingState, usePreference } from '@app/hooks';
import { RouteEnum, StartupTab, type LoginRouteState, type Preferences, type ServerRouteState } from '@app/types';
import { getHostKey } from '@app/utils';

export interface StartupDestination {
  to: To;
  state?: ServerRouteState;
}

const PAGE_SESSION_KEY = 'webatrice.pageSession';

function navigationType(): string | undefined {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return undefined;
  }
  const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return navigation?.type;
}

export function detectPageReload(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, type: string | undefined): boolean {
  let seenThisTab = false;
  try {
    seenThisTab = (storage?.getItem(PAGE_SESSION_KEY) ?? null) !== null;
    storage?.setItem(PAGE_SESSION_KEY, '1');
  } catch {
    /* storage blocked: use the navigation type when available */
  }
  return type === undefined ? seenThisTab : type === 'reload';
}

function sessionStorageOrUndefined(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export const pageLoadLoginGate = { done: false, reload: detectPageReload(sessionStorageOrUndefined(), navigationType()) };

export function resolveStartupDestination(
  preferences: Pick<Preferences, 'startupTab' | 'startupServer' | 'startupRoom'>,
  loginServer: string | undefined,
  from: string | undefined,
  applyStartupTab: boolean,
): StartupDestination {
  if (!applyStartupTab) {
    return { to: from ?? RouteEnum.SERVER };
  }
  switch (preferences.startupTab) {
    case StartupTab.DeckStorage:
      return { to: RouteEnum.DECKS };
    case StartupTab.Replays:
      return { to: RouteEnum.REPLAYS };
    case StartupTab.ServerRoom: {
      const onStartupServer = !preferences.startupServer || preferences.startupServer === loginServer;
      return onStartupServer && preferences.startupRoom
        ? { to: RouteEnum.SERVER, state: { startupRoom: preferences.startupRoom } }
        : { to: RouteEnum.SERVER };
    }
    default:
      return { to: RouteEnum.SERVER };
  }
}

export function useStartupDestination(isConnected: boolean): StartupDestination {
  const location = useLocation();
  const preferences = {
    startupTab: usePreference('startupTab'),
    startupServer: usePreference('startupServer'),
    startupRoom: usePreference('startupRoom'),
  };
  const knownHosts = useKnownHosts();
  const selectedHost = knownHosts.status === LoadingState.READY ? knownHosts.value?.selectedHost : undefined;
  const [eligibility] = useState(() => ({
    applyStartupTab: !pageLoadLoginGate.done && !pageLoadLoginGate.reload,
    from: (location.state as LoginRouteState | null)?.from,
  }));

  useEffect(() => {
    if (isConnected) {
      pageLoadLoginGate.done = true;
    }
  }, [isConnected]);

  return isConnected
    ? resolveStartupDestination(
      preferences,
      selectedHost && getHostKey(selectedHost),
      eligibility.from,
      eligibility.applyStartupTab,
    )
    : { to: RouteEnum.SERVER };
}
