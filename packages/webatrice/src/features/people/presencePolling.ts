import type { Enriched, GamesOfUserStatus } from '@cockatrice/datatrice';

import type { KnownGames } from './buddyActivity';

export const PRESENCE_POLL_MS = 60_000;
export const PRESENCE_BATCH = 25;

export interface PresenceStore {
  gamesOfUser: Readonly<Record<string, Readonly<Record<number, Enriched.Game>>>>;
  roomNames: Readonly<Record<string, Readonly<Record<number, string>>>>;
  status: Readonly<Record<string, GamesOfUserStatus>>;
}

export function dueForRefresh(
  names: readonly string[],
  lastFetched: ReadonlyMap<string, number>,
  status: PresenceStore['status'],
  now: number,
  intervalMs = PRESENCE_POLL_MS,
  batch = PRESENCE_BATCH,
): string[] {
  return [...new Set(names)]
    .filter((name) => status[name]?.state !== 'loading')
    .filter((name) => now - (lastFetched.get(name) ?? Number.NEGATIVE_INFINITY) >= intervalMs)
    .sort((a, b) => (lastFetched.get(a) ?? Number.NEGATIVE_INFINITY) - (lastFetched.get(b) ?? Number.NEGATIVE_INFINITY))
    .slice(0, batch);
}

export function mergeKnownGames(
  previous: Readonly<Record<string, KnownGames>>,
  names: readonly string[],
  store: PresenceStore,
): Record<string, KnownGames> {
  const next: Record<string, KnownGames> = {};
  for (const name of names) {
    const state = store.status[name]?.state;
    if (state === 'loaded') {
      const games = Object.values(store.gamesOfUser[name] ?? {});
      const roomNames = store.roomNames[name] ?? {};
      const prev = previous[name];
      next[name] = prev && sameGames(prev, games, roomNames) ? prev : { games, roomNames };
    } else if (state === 'loading' && previous[name]) {
      next[name] = previous[name];
    }
  }
  return next;
}

function sameGames(prev: KnownGames, games: Enriched.Game[], roomNames: Readonly<Record<number, string>>): boolean {
  return prev.roomNames === roomNames
    && prev.games.length === games.length
    && prev.games.every((game, index) => game === games[index]);
}
