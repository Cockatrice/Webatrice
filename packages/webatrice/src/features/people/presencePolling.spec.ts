import type { GamesOfUserStatus } from '@cockatrice/datatrice';
import { makeGame } from '@cockatrice/datatrice/testing';

import { dueForRefresh, mergeKnownGames, PRESENCE_POLL_MS } from './presencePolling';

describe('dueForRefresh', () => {
  it('fetches names never fetched, deduplicated, and skips requests already in flight', () => {
    expect(dueForRefresh(['a', 'b', 'a', 'c'], new Map(), { c: { state: 'loading' } }, 0)).toEqual(['a', 'b']);
  });

  it('waits a full interval before fetching a name again, oldest first', () => {
    const last = new Map([['a', 1000], ['b', 500], ['c', 5000]]);
    expect(dueForRefresh(['a', 'b', 'c'], last, {}, 1000 + PRESENCE_POLL_MS - 1)).toEqual(['b']);
    expect(dueForRefresh(['a', 'b', 'c'], last, {}, 5000 + PRESENCE_POLL_MS)).toEqual(['b', 'a', 'c']);
  });

  it('caps one round at the batch size', () => {
    const names = Array.from({ length: 40 }, (_, i) => `u${i}`);
    expect(dueForRefresh(names, new Map(), {}, 0, PRESENCE_POLL_MS, 25)).toHaveLength(25);
  });
});

describe('mergeKnownGames', () => {
  const game = makeGame({ gameId: 1 });
  const roomNames = { kira: { 1: 'General' } };
  const store = (status: GamesOfUserStatus) => ({ gamesOfUser: { kira: { 1: game } }, roomNames, status: { kira: status } });

  it('takes loaded answers and keeps the previous answer while a refresh is in flight', () => {
    const loaded = mergeKnownGames({}, ['kira'], store({ state: 'loaded' }));
    expect(loaded.kira.games).toEqual([game]);
    expect(mergeKnownGames(loaded, ['kira'], store({ state: 'loading' })).kira).toBe(loaded.kira);
  });

  it('keeps the same object when nothing changed, and drops failed or offline names', () => {
    const loaded = mergeKnownGames({}, ['kira'], store({ state: 'loaded' }));
    expect(mergeKnownGames(loaded, ['kira'], store({ state: 'loaded' })).kira).toBe(loaded.kira);
    expect(mergeKnownGames(loaded, ['kira'], store({ state: 'failed', responseCode: 16 }))).toEqual({});
    expect(mergeKnownGames(loaded, [], store({ state: 'loaded' }))).toEqual({});
  });
});
