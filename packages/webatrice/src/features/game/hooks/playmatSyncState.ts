import type { games } from '@cockatrice/datatrice';
import type { PlaymatSettings } from '@app/hooks';
import { onSessionEnd } from '@app/services/session';

export interface PlaymatSyncState {
  deckHash: string;
  deckPlaymat: games.Playmat | null;
  lastSent: games.Playmat | null | undefined;
  lastResolved: games.Playmat | null;
  rotation: number;
  wasStarted: boolean;
  wasReady: boolean;
  settings: Pick<PlaymatSettings, 'mode' | 'fallbackBehavior' | 'fallbackList'> | undefined;
}

const states = new Map<number, PlaymatSyncState>();

export function getPlaymatSyncState(gameId: number): PlaymatSyncState {
  let state = states.get(gameId);
  if (!state) {
    state = {
      deckHash: '',
      deckPlaymat: null,
      lastSent: undefined,
      lastResolved: null,
      rotation: 0,
      wasStarted: false,
      wasReady: false,
      settings: undefined,
    };
    states.set(gameId, state);
  }
  return state;
}

export function prunePlaymatSyncState(liveGameIds: readonly number[]): void {
  for (const gameId of states.keys()) {
    if (!liveGameIds.includes(gameId)) {
      states.delete(gameId);
    }
  }
}

export function clearPlaymatSyncState(): void {
  states.clear();
}

onSessionEnd(clearPlaymatSyncState);
