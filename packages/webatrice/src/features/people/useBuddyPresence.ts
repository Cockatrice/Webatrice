import { useEffect, useMemo, useRef, useState } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';
import { useAppSelector } from '@app/store';

import { activityOf, type Activity, type KnownGames } from './buddyActivity';
import { dueForRefresh, mergeKnownGames, PRESENCE_POLL_MS, type PresenceStore } from './presencePolling';

function usePresenceStore(): PresenceStore {
  const gamesOfUser = useAppSelector((state) => state.server.gamesOfUser);
  const roomNames = useAppSelector((state) => state.server.gamesOfUserRoomNames);
  const status = useAppSelector((state) => state.server.gamesOfUserStatus);
  return useMemo(() => ({ gamesOfUser, roomNames, status }), [gamesOfUser, roomNames, status]);
}

function usePresencePolling(names: readonly string[], status: PresenceStore['status']): void {
  const webClient = useWebClient();
  const lastFetched = useRef(new Map<string, number>());
  const latest = useRef({ names, status });
  latest.current = { names, status };
  const key = names.join('\n');

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      const now = Date.now();
      for (const name of dueForRefresh(latest.current.names, lastFetched.current, latest.current.status, now)) {
        lastFetched.current.set(name, now);
        webClient.request.session.getGamesOfUser(name);
      }
    };
    const start = () => {
      if (timer === null && document.visibilityState !== 'hidden') {
        tick();
        timer = setInterval(tick, PRESENCE_POLL_MS);
      }
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [key, webClient]);
}

export function useBuddyPresence(onlineBuddies: readonly string[]): Readonly<Record<string, Activity>> {
  const store = usePresenceStore();
  usePresencePolling(onlineBuddies, store.status);
  const [known, setKnown] = useState<Record<string, KnownGames>>(() => mergeKnownGames({}, onlineBuddies, store));

  useEffect(() => {
    setKnown((previous) => mergeKnownGames(previous, onlineBuddies, store));
  }, [onlineBuddies, store]);

  return useMemo(
    () => Object.fromEntries(onlineBuddies.map((name) => [name, activityOf(name, known[name])])),
    [onlineBuddies, known],
  );
}
