import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { deriveLoginProgress, type LoginProgress } from './loginProgress';

export function useLoginProgress({
  hasServer,
  submitting,
  failed,
}: {
  hasServer: boolean;
  submitting: boolean;
  failed: boolean;
}): LoginProgress {
  const testConnectionStatus = useAppSelector(server.Selectors.getTestConnectionStatus);
  const connectionState = useAppSelector(server.Selectors.getState);
  return deriveLoginProgress({ hasServer, testConnectionStatus, connectionState, submitting, failed });
}
