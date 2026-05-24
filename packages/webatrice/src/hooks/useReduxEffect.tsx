// Adapted from https://github.com/Qeepsake/use-redux-effect (MIT, Aspect Apps Limited).

import { useEffect, useRef, DependencyList } from 'react'
import { useStore } from 'react-redux'

export interface ReduxEffectAction<P = unknown> {
  type: string;
  payload: P;
  meta: unknown;
  error: boolean;
  count: number;
}

export type ReduxEffect<P = unknown> = (action: ReduxEffectAction<P>) => void;

export function useReduxEffect<P = unknown>(
  effect: ReduxEffect<P>,
  type: string | string[],
  deps: DependencyList = [],
): void {
  const store = useStore();
  const effectRef = useRef(effect);
  const typeRef = useRef(type);
  const lastHandledCountRef = useRef<number>(-1);

  effectRef.current = effect;
  typeRef.current = type;

  useEffect(() => {
    const check = (): void => {
      const action = (store.getState() as { action?: ReduxEffectAction<P> }).action;
      if (!action || action.count === lastHandledCountRef.current) {
        return;
      }
      lastHandledCountRef.current = action.count;
      const types = Array.isArray(typeRef.current) ? typeRef.current : [typeRef.current];
      if (types.includes(action.type)) {
        effectRef.current(action);
      }
    };

    check();

    const unsubscribe = store.subscribe(check);
    return (): void => unsubscribe();
  }, deps);
}
