import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { ArrowTarget } from '../components/ui/PlayerBoard/playerBoard.types';
import { useTargetCommandsFor } from '../components/ui/GameBoardCell/usePlayerTargetCommands';
import { createPendingPointerStore, type PendingPointer, type PendingPointerStore } from './pendingPointerStore';
import { planArrow, planAttach, sendArrowPlan, type ArrowPlan, type ArrowSource } from './arrowResolution';
import { arrowTargetAt } from './useArrowDrag';
import { useGameAccess } from './useGameAccess';

export interface PendingTargetSource extends ArrowSource {
  name: string;
}

export type PendingTarget =
  | { kind: 'arrow'; source: PendingTargetSource }
  | { kind: 'attach'; source: PendingTargetSource; extraSourceIds: readonly number[] };

export interface PendingTargetPicker {
  pending: PendingTarget | null;
  pointer: PendingPointerStore;
  startArrow(source: PendingTargetSource): void;
  startAttach(source: PendingTargetSource, extraSourceIds?: readonly number[]): void;
  cancel(): void;
  pick(target: ArrowTarget): boolean;
  pickArrowAt(element: Element | null): boolean;
  pickAttachTarget(target: ArrowTarget): boolean;
}

export function usePendingTarget(gameId: number | undefined): PendingTargetPicker {
  const { localPlayerId } = useGameAccess(gameId);
  const targetCommandsFor = useTargetCommandsFor(gameId);
  const [pending, setPendingState] = useState<PendingTarget | null>(null);
  const [pointer] = useState(createPendingPointerStore);
  const pendingRef = useRef(pending);
  const setPending = useCallback((next: PendingTarget | null) => {
    pendingRef.current = next;
    setPendingState(next);
  }, []);

  const resolve = useCallback((target: ArrowTarget, only?: PendingTarget['kind']): boolean => {
    const current = pendingRef.current;
    if (!current || (only && current.kind !== only) || !targetCommandsFor) {
      return false;
    }
    const { source } = current;
    const plan: ArrowPlan = current.kind === 'arrow'
      ? planArrow(source, target, localPlayerId)
      : planAttach(source.playerId, [source.cardId, ...current.extraSourceIds], target);
    sendArrowPlan(plan, targetCommandsFor);
    setPending(null);
    return true;
  }, [localPlayerId, targetCommandsFor, setPending]);

  const arrowPending = pending?.kind === 'arrow';
  useEffect(() => {
    if (!arrowPending) {
      return undefined;
    }
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) {
        return;
      }
      const target = arrowTargetAt(e.target instanceof Element ? e.target : null);
      if (!target) {
        setPending(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      resolve(target);
    };
    window.addEventListener('click', onClick, { capture: true });
    return () => window.removeEventListener('click', onClick, { capture: true });
  }, [arrowPending, resolve, setPending]);

  const active = pending != null;
  useEffect(() => {
    if (!active) {
      pointer.set(null);
      return undefined;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.MuiDialog-root[role="dialog"]')) {
        e.preventDefault();
        setPending(null);
      }
    };
    const onMove = (e: MouseEvent) => pointer.set({ x: e.clientX, y: e.clientY });
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMove);
    };
  }, [active, pointer, setPending]);

  const actions = useMemo(() => ({
    startArrow: (source: PendingTargetSource) => setPending({ kind: 'arrow', source }),
    startAttach: (source: PendingTargetSource, extraSourceIds: readonly number[] = []) =>
      setPending({ kind: 'attach', source, extraSourceIds }),
    cancel: () => setPending(null),
    pick: (target: ArrowTarget) => resolve(target),
    pickAttachTarget: (target: ArrowTarget) => resolve(target, 'attach'),
    pickArrowAt: (element: Element | null) => {
      if (pendingRef.current?.kind !== 'arrow') {
        return false;
      }
      const target = arrowTargetAt(element);
      if (target) {
        resolve(target);
      } else {
        setPending(null);
      }
      return true;
    },
  }), [resolve, setPending]);

  return useMemo(() => ({ pending, pointer, ...actions }), [pending, pointer, actions]);
}

export function usePendingPointer(store: PendingPointerStore): PendingPointer | null {
  return useSyncExternalStore(store.subscribe, store.get);
}
