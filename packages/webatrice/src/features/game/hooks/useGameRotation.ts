import { useCallback, useSyncExternalStore } from 'react';
import { useStore } from 'react-redux';
import { games } from '@cockatrice/datatrice';
import type { RootState } from '@app/store';

import type { RotationStep } from './useGameBoardLayout';

type GameStore = ReturnType<typeof useStore<RootState>>;

function createRotations(store: GameStore) {
  const steps = new Map<number, number>();
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | undefined;
  const notify = () => listeners.forEach((listener) => listener());

  return {
    read: (gameId: number | undefined) => gameId == null ? 0 : steps.get(gameId) ?? 0,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    rotate: (gameId: number | undefined, step: RotationStep) => {
      if (gameId == null || !games.Selectors.getGame(store.getState(), gameId)) {
        return;
      }
      unsubscribe ??= store.subscribe(() => {
        let changed = false;
        for (const id of steps.keys()) {
          if (!games.Selectors.getGame(store.getState(), id)) {
            steps.delete(id);
            changed = true;
          }
        }
        if (!steps.size) {
          unsubscribe?.();
          unsubscribe = undefined;
        }
        if (changed) {
          notify();
        }
      });
      steps.set(gameId, (steps.get(gameId) ?? 0) + step);
      notify();
    },
  };
}

const rotationsByStore = new WeakMap<GameStore, ReturnType<typeof createRotations>>();

export function useGameRotation(gameId: number | undefined) {
  const store = useStore<RootState>();
  let rotations = rotationsByStore.get(store);
  if (!rotations) {
    rotations = createRotations(store);
    rotationsByStore.set(store, rotations);
  }
  const rotationSteps = useSyncExternalStore(rotations.subscribe, () => rotations.read(gameId));
  const rotateView = useCallback((step: RotationStep) => rotations.rotate(gameId, step), [rotations, gameId]);
  return { rotationSteps, rotateView };
}
