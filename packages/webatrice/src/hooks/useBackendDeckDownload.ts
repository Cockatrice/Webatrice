import { useCallback } from 'react';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { RequestId } from '@cockatrice/sockatrice/types';

export function useBackendDeckDownload() {
  const client = useWebClient();
  return useCallback(
    (deckId: number, ...correlation: [requestId?: RequestId]) => client.request.session.deckDownload(deckId, ...correlation),
    [client],
  );
}
