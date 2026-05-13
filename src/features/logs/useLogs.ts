import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@app/components';
import { useWebClient } from '@app/hooks';
import { server, type ServerStateLogs } from 'datatrice';
import { useAppDispatch, useAppSelector } from '@app/store';
import { ViewLogHistoryParams } from 'sockatrice/generated';

const MAXIMUM_RESULTS = 1000;

// The form emits logLocation as a checkbox-state object; the wire schema
// wants a string[] of selected location names. `onSubmit` accepts the form
// shape and flattens internally before dispatching.
export interface LogsFormValues {
  userName?: string;
  ipAddress?: string;
  gameName?: string;
  gameId?: string;
  message?: string;
  logLocation?: { room?: boolean; game?: boolean; chat?: boolean };
}

export interface Logs {
  logs: ServerStateLogs;
  onSubmit: (fields: LogsFormValues) => void;
}

export function useLogs(): Logs {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const logs = useAppSelector((state) => server.Selectors.getLogs(state));
  const webClient = useWebClient();
  const { openToast } = useToast({
    key: 'logs-empty-filter',
    children: t('Logs.message.emptyFilter'),
  });

  useEffect(() => {
    return () => {
      dispatch(server.Actions.clearLogs());
    };
  }, [dispatch]);

  const trimFields = (fields: LogsFormValues): LogsFormValues => {
    const result: LogsFormValues = { ...fields };
    for (const key of Object.keys(result) as (keyof ViewLogHistoryParams)[]) {
      const field = result[key];
      if (typeof field === 'string') {
        const trimmed = field.trim();
        if (trimmed) {
          (result as Record<string, unknown>)[key] = trimmed;
        } else {
          delete (result as Record<string, unknown>)[key];
        }
      }
    }
    return result;
  };

  const flattenLogLocations = (logLocations: { room?: boolean; game?: boolean; chat?: boolean }): string[] =>
    (['room', 'game', 'chat'] as const).filter((k) => logLocations[k]);

  const onSubmit = (fields: LogsFormValues) => {
    const trimmed = trimFields(fields);
    const { userName, ipAddress, gameName, gameId, message, logLocation } = trimmed;

    const required = [userName, ipAddress, gameName, gameId, message].filter(Boolean);

    const wireParams: ViewLogHistoryParams = {
      $typeName: 'Command_ViewLogHistory.Params',
      userName: trimmed.userName,
      ipAddress: trimmed.ipAddress,
      gameName: trimmed.gameName,
      gameId: trimmed.gameId,
      message: trimmed.message,
      logLocation: logLocation ? flattenLogLocations(logLocation) : [],
      maximumResults: MAXIMUM_RESULTS,
    } as ViewLogHistoryParams;

    if (required.length) {
      webClient.request.moderator.viewLogHistory(wireParams);
    } else {
      openToast();
    }
  };

  return { logs, onSubmit };
}
