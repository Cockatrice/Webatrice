import { useSyncExternalStore } from 'react';
import { onSessionEnd } from '@app/services/session';

export interface GameLinkRequest {
  url: string;
  seq: number;
}

let current: GameLinkRequest | null = null;
let seq = 0;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export function requestGameLinkJoin(url: string): void {
  seq += 1;
  current = { url, seq };
  notify();
}

export function clearGameLinkRequest(): void {
  if (current) {
    current = null;
    notify();
  }
}

onSessionEnd(clearGameLinkRequest);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => current;

export function useGameLinkRequest(): GameLinkRequest | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
