import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

const FAILURE_KEYS: Record<WebsocketTypes.CommandFailure, string> = {
  [WebsocketTypes.CommandFailure.NotSent]: 'CommandFailure.notSent',
  [WebsocketTypes.CommandFailure.Timeout]: 'CommandFailure.timeout',
  [WebsocketTypes.CommandFailure.Disconnected]: 'CommandFailure.disconnected',
};

export function useCommandFailureMessage(): (
  failure: WebsocketTypes.CommandFailure | undefined,
  serverRejection: string,
) => string {
  const { t } = useTranslation();
  return useCallback(
    (failure, serverRejection) => (failure ? t(FAILURE_KEYS[failure]) : serverRejection),
    [t],
  );
}
