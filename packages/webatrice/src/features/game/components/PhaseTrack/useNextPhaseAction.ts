import { useStore } from 'react-redux';
import { games } from '@cockatrice/datatrice';
import type { RequestId } from '@cockatrice/sockatrice/types';
import type { RootState } from '@app/store';
import { useReduxEffect, useRequestTracker } from '@app/hooks';
import { onSessionEnd } from '@app/services/session';

import { nextPhaseActionPlan } from './phaseActions';
import { usePhaseBar } from './usePhaseBar';

export interface NextPhaseAction {
  canRun: boolean;
  run: () => void;
}

let pendingWraps = new WeakMap<object, Map<number, RequestId>>();
onSessionEnd(() => {
  pendingWraps = new WeakMap();
});

export function useNextPhaseAction(gameId: number | undefined): NextPhaseAction {
  const store = useStore<RootState>();
  const { activePhase, canPassTurn, canAdvancePhase, handlePhaseClick, handlePassAndUntap, handleUntapAll, handleDrawOne } =
    usePhaseBar(gameId);
  const requests = useRequestTracker();

  useReduxEffect<{ gameId: number; requestId?: RequestId }>(({ payload }) => {
    const pending = pendingWraps.get(store);
    if (payload.requestId !== undefined && pending?.get(payload.gameId) === payload.requestId) {
      pending.delete(payload.gameId);
    }
  }, [games.Types.NEXT_TURN_ANSWERED, games.Types.NEXT_TURN_FAILED], [store]);

  const allowed = (current: number) =>
    nextPhaseActionPlan(current).advance === 'nextTurn' ? canPassTurn : canAdvancePhase;

  const run = () => {
    if (gameId == null) {
      return;
    }
    const current = games.Selectors.getActivePhase(store.getState(), gameId) ?? -1;
    if (!allowed(current)) {
      return;
    }
    const plan = nextPhaseActionPlan(current);
    if (plan.advance === 'nextTurn') {
      let pending = pendingWraps.get(store);
      if (!pending) {
        pending = new Map();
        pendingWraps.set(store, pending);
      }
      if (pending.has(gameId)) {
        return;
      }
      const requestId = requests.begin();
      pending.set(gameId, requestId);
      if (handlePassAndUntap(requestId) === undefined) {
        pending.delete(gameId);
      }
      return;
    }
    handlePhaseClick(plan.advance.phase);
    if (plan.then === 'untapAll') {
      handleUntapAll();
    } else if (plan.then === 'drawOne') {
      handleDrawOne();
    }
  };

  return { canRun: allowed(activePhase ?? -1), run };
}
