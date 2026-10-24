import { makeGame } from '@cockatrice/datatrice/testing';

import { makeUser } from '../../__test-utils__';
import { activityOf, minutesSince, rowAction } from './buddyActivity';

const known = (...games: ReturnType<typeof makeGame>[]) => ({ games, roomNames: { 1: 'General', 2: 'Competitive' } });

describe('activityOf', () => {
  it('is unknown before the first answer and idle when the buddy is in no game', () => {
    expect(activityOf('kira', undefined)).toEqual({ kind: 'unknown' });
    expect(activityOf('kira', known())).toEqual({ kind: 'idle' });
  });

  it('prefers a game with an open seat and says whether the buddy hosts it', () => {
    const playing = makeGame({ gameId: 9, roomId: 2, started: true, playerCount: 2, maxPlayers: 2 });
    const waiting = makeGame({ gameId: 4, roomId: 1, playerCount: 3, maxPlayers: 4, creatorInfo: makeUser({ name: 'tomo' }) });
    expect(activityOf('tomo', known(playing, waiting))).toMatchObject({
      kind: 'waiting', room: 'General', hosting: true, open: 1, game: { gameId: 4 },
    });
  });

  it('reports the newest game being played with its start time', () => {
    const older = makeGame({ gameId: 3, started: true, playerCount: 2, maxPlayers: 2, startTime: 100 });
    const newer = makeGame({ gameId: 8, roomId: 2, started: true, playerCount: 2, maxPlayers: 2, startTime: 500 });
    expect(activityOf('kira', known(older, newer))).toMatchObject({
      kind: 'playing', room: 'Competitive', hosting: false, startTime: 500, game: { gameId: 8 },
    });
  });

  it('treats a full unstarted game as being played', () => {
    const full = makeGame({ gameId: 2, playerCount: 4, maxPlayers: 4 });
    expect(activityOf('kira', known(full)).kind).toBe('playing');
  });
});

describe('rowAction', () => {
  const waiting = activityOf('a', known(makeGame({ playerCount: 1, maxPlayers: 2 })));
  const watchable = activityOf('a', known(makeGame({ started: true, playerCount: 2, maxPlayers: 2, spectatorsAllowed: true })));
  const closed = activityOf('a', known(makeGame({ started: true, playerCount: 2, maxPlayers: 2, spectatorsAllowed: false })));

  it('offers join, watch or invite in that order of preference', () => {
    expect(rowAction(waiting, true, false)).toBe('join');
    expect(rowAction(watchable, true, false)).toBe('watch');
    expect(rowAction({ kind: 'idle' }, true, false)).toBe('invite');
    expect(rowAction({ kind: 'unknown' }, true, false)).toBe('invite');
  });

  it('offers nothing when spectating is closed or there is no game to invite to', () => {
    expect(rowAction(closed, true, false)).toBeNull();
    expect(rowAction({ kind: 'idle' }, false, false)).toBeNull();
  });

  it('lets staff who can override restrictions watch closed games', () => {
    expect(rowAction(closed, false, true)).toBe('watch');
  });
});

describe('minutesSince', () => {
  it('rounds to whole minutes, at least one, and is zero without a start time', () => {
    expect(minutesSince(0, 1_000_000)).toBe(0);
    expect(minutesSince(1000, 1000 * 1000 + 10_000)).toBe(1);
    expect(minutesSince(1000, (1000 + 21 * 60) * 1000)).toBe(21);
  });
});
