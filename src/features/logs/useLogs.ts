import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@app/components';
import { useWebClient } from '@app/hooks';
import { ServerActions, ServerSelectors, ServerStateLogs, useAppDispatch, useAppSelector } from '@app/store';
import { Data } from '@app/types';

const MAXIMUM_RESULTS = 1000;

export interface Logs {
  logs: ServerStateLogs;
  onSubmit: (fields: Data.ViewLogHistoryParams) => void;
}

export function useLogs(): Logs {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const logs = useAppSelector((state) => ServerSelectors.getLogs(state));
  const webClient = useWebClient();
  const { openToast } = useToast({
    key: 'logs-empty-filter',
    children: t('Logs.message.emptyFilter'),
  });

  useEffect(() => {
    return () => {
      dispatch(ServerActions.clearLogs());
    };
  }, [dispatch]);

  const trimFields = (fields: Data.ViewLogHistoryParams): Data.ViewLogHistoryParams => {
    const result: Data.ViewLogHistoryParams = { ...fields };
    for (const key of Object.keys(result) as (keyof Data.ViewLogHistoryParams)[]) {
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

  const flattenLogLocations = (logLocations: Record<string, unknown>): string[] =>
    Object.keys(logLocations);

  const onSubmit = (fields: Data.ViewLogHistoryParams) => {
    const trimmedFields = trimFields(fields);
    const { userName, ipAddress, gameName, gameId, message, logLocation } = trimmedFields as
      Data.ViewLogHistoryParams & { logLocation?: Record<string, unknown> };

    const required = [userName, ipAddress, gameName, gameId, message].filter(Boolean);

    if (logLocation) {
      trimmedFields.logLocation = flattenLogLocations(logLocation);
    }

    trimmedFields.maximumResults = MAXIMUM_RESULTS;

    if (required.length) {
      webClient.request.moderator.viewLogHistory(trimmedFields);
    } else {
      openToast();
    }
  };

  return { logs, onSubmit };
}
