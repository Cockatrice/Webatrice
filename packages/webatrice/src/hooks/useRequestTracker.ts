import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RequestId } from '@cockatrice/sockatrice/types';
import { onSessionEnd } from '@app/services/session';

let nextFallbackId = 0;
function newRequestId(): RequestId {
  return globalThis.crypto?.randomUUID?.() ?? `request-${++nextFallbackId}`;
}

export interface RequestTracker {
  begin(): RequestId;
  isCurrent(id: RequestId | undefined): boolean;
  cancel(): void;
  track(id: RequestId): void;
  settle(id: RequestId | undefined): boolean;
}

export function useRequestTracker(): RequestTracker {
  const current = useRef<RequestId | undefined>(undefined);
  const pending = useRef(new Set<RequestId>());
  const mounted = useRef(true);
  const cancel = useCallback(() => {
    current.current = undefined;
    pending.current.clear();
  }, []);
  const begin = useCallback(() => {
    const id = newRequestId();
    if (mounted.current) {
      current.current = id;
    }
    return id;
  }, []);
  const isCurrent = useCallback((id: RequestId | undefined) =>
    mounted.current && id !== undefined && id === current.current, []);
  const track = useCallback((id: RequestId) => {
    if (mounted.current) {
      pending.current.add(id);
    }
  }, []);
  const settle = useCallback((id: RequestId | undefined) =>
    mounted.current && id !== undefined && pending.current.delete(id), []);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onSessionEnd(cancel);
    return () => {
      mounted.current = false;
      cancel();
      unsubscribe();
    };
  }, [cancel]);

  return useMemo(() => ({ begin, isCurrent, cancel, track, settle }), [begin, isCurrent, cancel, track, settle]);
}
