import { useCallback, useState } from 'react';
import type { RequestId } from '@cockatrice/sockatrice/types';

import { useReduxEffect, useRequestTracker, type ReduxEffectAction } from '@app/hooks';

export type ReportListLoadState = 'loading' | 'failed' | 'ready';

export interface ReportListFailure {
  type: string;
  command: string;
  successType: string;
}

export function useReportListLoad(
  send: (requestId: RequestId) => void,
  failure: ReportListFailure,
): { loadState: ReportListLoadState; refresh: () => void } {
  const [loadState, setLoadState] = useState<ReportListLoadState>('loading');
  const request = useRequestTracker();

  const refresh = useCallback(() => {
    const requestId = request.begin();
    setLoadState('loading');
    send(requestId);
  }, [request, send]);

  useReduxEffect((action: ReduxEffectAction<{ requestId?: RequestId }>) => {
    if (request.isCurrent(action.payload.requestId)) {
      request.cancel();
      setLoadState('ready');
    }
  }, failure.successType, [request]);

  useReduxEffect((action: ReduxEffectAction<{ command: string; requestId?: RequestId }>) => {
    if (action.payload.command === failure.command && request.isCurrent(action.payload.requestId)) {
      request.cancel();
      setLoadState('failed');
    }
  }, failure.type, [failure.command, request]);

  return { loadState, refresh };
}
