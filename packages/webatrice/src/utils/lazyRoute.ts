import { lazy, type ComponentType } from 'react';

export class RouteChunkError extends Error {
  constructor(cause: unknown) {
    super('Route chunk failed to load', { cause });
    this.name = 'RouteChunkError';
  }
}

export function reloadRoute() {
  window.location.reload();
}

export function lazyRoute<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  let pending: Promise<{ default: T }> | undefined;
  let loaded = false;
  const preload = () => {
    pending ??= load()
      .then((module) => {
        loaded = true;
        return module;
      })
      .catch((cause: unknown) => {
        pending = undefined;
        throw new RouteChunkError(cause);
      });
    return pending;
  };
  return { Component: lazy(preload), isLoaded: () => loaded, preload };
}

export function scheduleRoutePrefetch(prefetch: () => void): () => void {
  let frame: number;
  let idle: number | undefined;
  let timer: number | undefined;
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(prefetch);
      } else {
        timer = window.setTimeout(prefetch, 1000);
      }
    });
  });
  return () => {
    cancelAnimationFrame(frame);
    if (idle !== undefined) {
      window.cancelIdleCallback(idle);
    }
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
  };
}
