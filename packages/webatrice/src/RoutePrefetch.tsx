import { useCallback, useEffect, useRef } from 'react';
import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { lazyRoutes, prefetchRoutes } from './lazyRoutes';
import { scheduleRoutePrefetch } from './utils/lazyRoute';

export function useDeckEditorRoutePrefetch(): () => void {
  const started = useRef(lazyRoutes.DeckEditor.isLoaded());
  const prefetch = useCallback(() => {
    if (started.current || lazyRoutes.DeckEditor.isLoaded()) {
      started.current = true;
      return;
    }
    started.current = true;
    void lazyRoutes.DeckEditor.preload().catch(() => {
      started.current = false;
    });
  }, []);
  useEffect(() => {
    if (!started.current && !lazyRoutes.DeckEditor.isLoaded()) {
      return scheduleRoutePrefetch(prefetch);
    }
  }, [prefetch]);
  return prefetch;
}

export default function RoutePrefetch() {
  const connected = useAppSelector(server.Selectors.getIsConnected);
  useEffect(() => {
    if (connected) {
      return scheduleRoutePrefetch(prefetchRoutes);
    }
  }, [connected]);
  return null;
}
