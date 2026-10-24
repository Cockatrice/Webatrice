import { useCallback, useSyncExternalStore } from 'react';

import { notificationStore } from '@app/services';

import {
  chatDockReducer,
  EMPTY_CHAT_DOCK,
  expandedChatNames,
  dockCapacity,
  CHAT_DOCK_MARGIN_PX,
  PAGE_KEEP_PX,
  type ChatDockAction,
  type ChatDockState,
} from './chatDockState';

let state: ChatDockState = EMPTY_CHAT_DOCK;
const listeners = new Set<() => void>();
const drafts = new Map<string, string>();
const draftListeners = new Set<() => void>();

function notify(set: Set<() => void>): void {
  set.forEach((listener) => listener());
}

export function dispatchChatDock(action: ChatDockAction): void {
  if (action.type === 'reset' && drafts.size > 0) {
    drafts.clear();
    notify(draftListeners);
  }
  const next = chatDockReducer(state, action);
  if (next !== state) {
    state = next;
    notify(listeners);
  }
}

export function getChatDockState(): ChatDockState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useChatDockState(): ChatDockState {
  return useSyncExternalStore(subscribe, getChatDockState, getChatDockState);
}

export function getExpandedChats(): string[] {
  return expandedChatNames(state);
}

function pageShowsDock(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return false;
  }
  return !notificationStore.getState().drawerOpen;
}

export function getVisibleChats(): string[] {
  return pageShowsDock() ? expandedChatNames(state) : [];
}

function subscribeVisibility(listener: () => void): () => void {
  const unsubscribeDock = subscribe(listener);
  const unsubscribeNotifications = notificationStore.subscribe(listener);
  document.addEventListener('visibilitychange', listener);
  return () => {
    unsubscribeDock();
    unsubscribeNotifications();
    document.removeEventListener('visibilitychange', listener);
  };
}

export function useChatVisible(name: string): boolean {
  const snapshot = useCallback(() => pageShowsDock() && state.chats.some((chat) => chat.name === name && chat.expanded), [name]);
  return useSyncExternalStore(subscribeVisibility, snapshot, snapshot);
}

export function getChatDraft(name: string): string {
  return drafts.get(name) ?? '';
}

export function setChatDraft(name: string, text: string): void {
  if (getChatDraft(name) === text) {
    return;
  }
  if (text) {
    drafts.set(name, text);
  } else {
    drafts.delete(name);
  }
  notify(draftListeners);
}

function subscribeDrafts(listener: () => void): () => void {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

export function useChatDraft(name: string): [string, (text: string) => void] {
  const read = useCallback(() => getChatDraft(name), [name]);
  const draft = useSyncExternalStore(subscribeDrafts, read, read);
  const write = useCallback((text: string) => setChatDraft(name, text), [name]);
  return [draft, write];
}

let dockRoomPx: number | null = null;

export function setChatDockRoom(px: number | null): void {
  dockRoomPx = px;
}

function defaultDockRoom(): number {
  const width = typeof window === 'undefined' ? 1440 : window.innerWidth;
  return width - CHAT_DOCK_MARGIN_PX - PAGE_KEEP_PX;
}

export function currentMaxExpandedChats(adding?: string): number {
  const total = state.chats.length + (adding && !state.chats.some((chat) => chat.name === adding) ? 1 : 0);
  return dockCapacity(dockRoomPx ?? defaultDockRoom(), total);
}

export function useOpenChat(): (userName: string) => void {
  return useCallback((userName: string) => dispatchChatDock({ type: 'open', name: userName, max: currentMaxExpandedChats(userName) }), []);
}
