import { onSessionEnd } from '@app/services/session';

import { closeSystemNotifications } from './NotificationService';

export type NotificationKind = 'message' | 'mention' | 'buddy' | 'game' | 'report';

export type NotificationTarget =
  | { type: 'chat'; userName: string }
  | { type: 'room'; roomId: number }
  | { type: 'game'; gameId: number }
  | { type: 'route'; path: string };

export interface NotificationInput {
  kind: NotificationKind;
  target: NotificationTarget;
  actor?: string;
  place?: string;
  title?: string;
  body?: string;
  seats?: { taken: number; max: number };
}

export interface NotificationEntry extends NotificationInput {
  id: number;
  time: number;
  read: boolean;
}

export type UnreadScope = 'rooms' | 'games' | 'chats';

export type MentionScope = 'rooms' | 'games';

export type MentionCounts = Readonly<Record<MentionScope, Readonly<Record<number, number>>>>;

export interface NotificationState {
  entries: readonly NotificationEntry[];
  rooms: Readonly<Record<number, number>>;
  games: Readonly<Record<number, number>>;
  chats: Readonly<Record<string, number>>;
  mentions: MentionCounts;
  seq: number;
  drawerOpen: boolean;
}

export type NotificationAction =
  | { type: 'append'; entry: NotificationInput; time: number; read: boolean }
  | { type: 'markEntryRead'; id: number }
  | { type: 'markAllRead' }
  | { type: 'bump'; scope: UnreadScope; key: number | string; mention?: boolean }
  | { type: 'clear'; scope: UnreadScope; key: number | string }
  | { type: 'setDrawer'; open: boolean };

export const MAX_ENTRIES = 200;

export const initialNotificationState: NotificationState = {
  entries: [],
  rooms: {},
  games: {},
  chats: {},
  mentions: { rooms: {}, games: {} },
  seq: 0,
  drawerOpen: false,
};

const TARGET_SCOPE: Record<NotificationTarget['type'], UnreadScope | null> = {
  chat: 'chats',
  room: 'rooms',
  game: 'games',
  route: null,
};

function targetKey(target: NotificationTarget): number | string | null {
  switch (target.type) {
    case 'chat':
      return target.userName;
    case 'room':
      return target.roomId;
    case 'game':
      return target.gameId;
    default:
      return null;
  }
}

export function targetsMatch(target: NotificationTarget, scope: UnreadScope, key: number | string): boolean {
  return TARGET_SCOPE[target.type] === scope && targetKey(target) === key;
}

function withoutKey<T>(record: Readonly<Record<string | number, T>>, key: number | string) {
  if (!(key in record)) {
    return record;
  }
  const next = { ...record };
  delete next[key];
  return next;
}

function isMentionScope(scope: UnreadScope): scope is MentionScope {
  return scope === 'rooms' || scope === 'games';
}

function bumpMention(mentions: MentionCounts, scope: UnreadScope, key: number | string): MentionCounts {
  if (!isMentionScope(scope)) {
    return mentions;
  }
  const counts = mentions[scope];
  return { ...mentions, [scope]: { ...counts, [key]: (counts[key as number] ?? 0) + 1 } };
}

function clearMention(mentions: MentionCounts, scope: UnreadScope, key: number | string): MentionCounts {
  if (!isMentionScope(scope)) {
    return mentions;
  }
  const counts = withoutKey(mentions[scope], key);
  return counts === mentions[scope] ? mentions : { ...mentions, [scope]: counts };
}

function markEntries(entries: readonly NotificationEntry[], match: (entry: NotificationEntry) => boolean) {
  if (!entries.some((entry) => !entry.read && match(entry))) {
    return entries;
  }
  return entries.map((entry) => (!entry.read && match(entry) ? { ...entry, read: true } : entry));
}

export function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'append': {
      const seq = state.seq + 1;
      const entry: NotificationEntry = { ...action.entry, id: seq, time: action.time, read: action.read };
      return { ...state, seq, entries: [entry, ...state.entries].slice(0, MAX_ENTRIES) };
    }
    case 'markEntryRead': {
      const entries = markEntries(state.entries, (entry) => entry.id === action.id);
      return entries === state.entries ? state : { ...state, entries };
    }
    case 'markAllRead': {
      const entries = markEntries(state.entries, () => true);
      return entries === state.entries ? state : { ...state, entries };
    }
    case 'bump': {
      const counts = state[action.scope] as Record<string | number, number>;
      const mentions = action.mention ? bumpMention(state.mentions, action.scope, action.key) : state.mentions;
      return { ...state, mentions, [action.scope]: { ...counts, [action.key]: (counts[action.key] ?? 0) + 1 } };
    }
    case 'clear': {
      const before = state[action.scope] as Record<string | number, number>;
      const counts = withoutKey(before, action.key);
      const mentions = clearMention(state.mentions, action.scope, action.key);
      const entries = markEntries(state.entries, (entry) => targetsMatch(entry.target, action.scope, action.key));
      if (counts === before && mentions === state.mentions && entries === state.entries) {
        return state;
      }
      return { ...state, [action.scope]: counts, mentions, entries };
    }
    case 'setDrawer':
      return state.drawerOpen === action.open ? state : { ...state, drawerOpen: action.open };
    default:
      return state;
  }
}

export interface NotificationStore {
  getState: () => NotificationState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: NotificationAction) => void;
  reset: () => void;
}

export function createNotificationStore(): NotificationStore {
  let state = initialNotificationState;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action) => {
      const next = notificationReducer(state, action);
      if (next !== state) {
        state = next;
        emit();
      }
    },
    reset: () => {
      state = { ...initialNotificationState, seq: state.seq };
      emit();
    },
  };
}

export const notificationStore = createNotificationStore();

let generation = 0;

export function bindToSession<A extends unknown[]>(callback: (...args: A) => void): (...args: A) => void {
  const owner = generation;
  return (...args: A) => {
    if (owner === generation) {
      callback(...args);
    }
  };
}

export function logNotification(entry: NotificationInput, read = false, time = Date.now()): number {
  notificationStore.dispatch({ type: 'append', entry, time, read });
  return notificationStore.getState().seq;
}

onSessionEnd(() => {
  generation += 1;
  closeSystemNotifications();
  notificationStore.reset();
});
