import { endSession } from '@app/services/session';

import {
  bindToSession,
  initialNotificationState,
  logNotification,
  MAX_ENTRIES,
  notificationReducer,
  notificationStore,
  type NotificationInput,
  type NotificationState,
} from './notificationStore';
import { selectUnreadCounts } from './unreadCounts';

const mention: NotificationInput = { kind: 'mention', actor: 'bob', place: 'Magic', target: { type: 'room', roomId: 3 } };
const message: NotificationInput = { kind: 'message', actor: 'bob', body: 'hi', target: { type: 'chat', userName: 'bob' } };
const report: NotificationInput = { kind: 'report', title: 'Report resolved', target: { type: 'route', path: '/my-reports' } };

const apply = (...actions: Parameters<typeof notificationReducer>[1][]) =>
  actions.reduce<NotificationState>(notificationReducer, initialNotificationState);

describe('notificationReducer', () => {
  it('appends newest first with increasing ids and caps the session log', () => {
    let state = apply({ type: 'append', entry: mention, time: 1, read: false }, { type: 'append', entry: message, time: 2, read: true });
    expect(state.entries.map((entry) => [entry.id, entry.kind, entry.read])).toEqual([[2, 'message', true], [1, 'mention', false]]);

    for (let i = 0; i < MAX_ENTRIES; i += 1) {
      state = notificationReducer(state, { type: 'append', entry: report, time: 3, read: false });
    }
    expect(state.entries).toHaveLength(MAX_ENTRIES);
  });

  it('clearing a room drops its count and marks the entries that point at it read', () => {
    const state = apply(
      { type: 'append', entry: mention, time: 1, read: false },
      { type: 'append', entry: message, time: 1, read: false },
      { type: 'bump', scope: 'rooms', key: 3 },
      { type: 'bump', scope: 'rooms', key: 3 },
      { type: 'bump', scope: 'rooms', key: 4 },
    );
    expect(state.rooms).toEqual({ 3: 2, 4: 1 });

    const cleared = notificationReducer(state, { type: 'clear', scope: 'rooms', key: 3 });
    expect(cleared.rooms).toEqual({ 4: 1 });
    expect(cleared.entries.map((entry) => [entry.kind, entry.read])).toEqual([['message', false], ['mention', true]]);
    expect(notificationReducer(cleared, { type: 'clear', scope: 'rooms', key: 3 })).toBe(cleared);
  });

  it('counts mentions per room and game beside the unread counts and clears them together', () => {
    const state = apply(
      { type: 'bump', scope: 'rooms', key: 3, mention: true },
      { type: 'bump', scope: 'rooms', key: 3 },
      { type: 'bump', scope: 'games', key: 7, mention: true },
      { type: 'bump', scope: 'games', key: 7, mention: true },
      { type: 'bump', scope: 'chats', key: 'bob', mention: true },
    );
    expect(state.rooms).toEqual({ 3: 2 });
    expect(state.mentions).toEqual({ rooms: { 3: 1 }, games: { 7: 2 } });

    const cleared = notificationReducer(state, { type: 'clear', scope: 'games', key: 7 });
    expect(cleared.mentions).toEqual({ rooms: { 3: 1 }, games: {} });
    expect(notificationReducer(cleared, { type: 'clear', scope: 'rooms', key: 3 }).mentions).toEqual({ rooms: {}, games: {} });
  });

  it('marks one entry or all entries read, keeping the state when nothing changes', () => {
    const state = apply({ type: 'append', entry: mention, time: 1, read: false }, { type: 'append', entry: report, time: 1, read: false });
    const one = notificationReducer(state, { type: 'markEntryRead', id: 2 });
    expect(one.entries.map((entry) => entry.read)).toEqual([true, false]);
    const all = notificationReducer(one, { type: 'markAllRead' });
    expect(all.entries.every((entry) => entry.read)).toBe(true);
    expect(notificationReducer(all, { type: 'markAllRead' })).toBe(all);
  });
});

describe('selectUnreadCounts', () => {
  it('counts each unread thing once: sessions by id, plus log entries no session covers', () => {
    const state = apply(
      { type: 'append', entry: mention, time: 1, read: false },
      { type: 'append', entry: message, time: 1, read: false },
      { type: 'append', entry: report, time: 1, read: false },
      { type: 'bump', scope: 'rooms', key: 3 },
      { type: 'bump', scope: 'chats', key: 'bob' },
      { type: 'bump', scope: 'games', key: 7 },
    );
    const counts = selectUnreadCounts(state);
    expect(counts).toEqual({
      rooms: { 3: 1 }, games: { 7: 1 }, chats: { bob: 1 }, mentions: { rooms: {}, games: {} }, notifications: 3, total: 4,
    });
    expect(selectUnreadCounts(state)).toBe(counts);
  });
});

describe('notification store', () => {
  beforeEach(() => {
    notificationStore.reset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a session-bound callback only within the session that made it', () => {
    const run = vi.fn();
    const current = bindToSession(run);
    const stale = bindToSession(run);
    current();
    endSession();
    stale();
    bindToSession(run)();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('forgets the log when the session ends without reusing entry ids', () => {
    const before = logNotification(report);
    endSession();
    expect(notificationStore.getState().entries).toEqual([]);
    expect(logNotification(report)).toBeGreaterThan(before);
  });
});
