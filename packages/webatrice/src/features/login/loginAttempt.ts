import { useSyncExternalStore } from 'react';

export interface LoginAttemptState {
  target: string | null;
  pending: boolean;
  failed: boolean;
}

const IDLE: LoginAttemptState = { target: null, pending: false, failed: false };

let state: LoginAttemptState = IDLE;
const listeners = new Set<() => void>();

function set(next: LoginAttemptState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export const loginAttempt = {
  started(target: string): void {
    set({ target, pending: true, failed: false });
  },
  failed(): void {
    if (state.pending) {
      set({ ...state, pending: false, failed: true });
    }
  },
  succeeded(): void {
    set(IDLE);
  },
  reset(): void {
    set(IDLE);
  },
  get(): LoginAttemptState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function attemptFailedFor(attempt: LoginAttemptState, target: string | null): boolean {
  return attempt.failed && target !== null && attempt.target === target;
}

export function useLoginAttemptFailed(target: string | null): boolean {
  const attempt = useSyncExternalStore(loginAttempt.subscribe, loginAttempt.get);
  return attemptFailedFor(attempt, target);
}
