import { useEffect, useSyncExternalStore } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

import { RouteEnum } from '@app/types';

export type ToastLane = 'top' | 'bottom';

const TOP_CONTROL_ROUTES: readonly string[] = [RouteEnum.DECK_DRAFT, RouteEnum.DECK];

export function toastLaneFor(pathname: string): ToastLane {
  return TOP_CONTROL_ROUTES.some((path) => matchPath({ path, end: true }, pathname)) ? 'bottom' : 'top';
}

let lane: ToastLane = 'top';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToastLane(): ToastLane {
  return useSyncExternalStore(subscribe, () => lane, () => lane);
}

export function useToastLaneForRoute(): void {
  const { pathname } = useLocation();
  const next = toastLaneFor(pathname);
  useEffect(() => {
    if (lane !== next) {
      lane = next;
      listeners.forEach((listener) => listener());
    }
  }, [next]);
}
