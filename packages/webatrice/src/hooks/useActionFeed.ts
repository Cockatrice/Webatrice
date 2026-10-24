import { useEffect, useRef } from 'react';
import { useStore } from 'react-redux';
import { listenerMiddleware } from '@cockatrice/datatrice';

import type { RootState } from '@app/store';

interface ObservedAction {
  type: string | null;
  payload: unknown;
}

export type ActionFeedHandler = (action: ObservedAction, before: RootState, after: RootState) => void;
export type ActionFeedPredicate = (action: ObservedAction) => boolean;

export function useActionFeed(handler: ActionFeedHandler, predicate?: ActionFeedPredicate): void {
  const store = useStore<RootState>();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const predicateRef = useRef(predicate);
  predicateRef.current = predicate;

  useEffect(() => listenerMiddleware.startListening({
    predicate: (action) => predicateRef.current?.({ type: action.type, payload: action.payload }) ?? true,
    effect: (action, api) => {
      if (api.getState !== store.getState) {
        return;
      }
      handlerRef.current(
        { type: action.type, payload: action.payload },
        api.getOriginalState() as RootState,
        api.getState() as RootState,
      );
    },
  }), [store]);
}
