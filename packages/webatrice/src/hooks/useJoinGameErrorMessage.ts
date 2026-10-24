import { useTranslation } from 'react-i18next';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { useCommandFailureMessage } from './useCommandFailureMessage';

const ERROR_KEYS: Partial<Record<Response_ResponseCode, string>> = {
  [Response_ResponseCode.RespNotInRoom]: 'JoinGameError.notInRoom',
  [Response_ResponseCode.RespNameNotFound]: 'JoinGameError.notFound',
  [Response_ResponseCode.RespGameFull]: 'JoinGameError.full',
  [Response_ResponseCode.RespWrongPassword]: 'JoinGameError.wrongPassword',
  [Response_ResponseCode.RespSpectatorsNotAllowed]: 'JoinGameError.noSpectators',
  [Response_ResponseCode.RespOnlyBuddies]: 'JoinGameError.buddiesOnly',
  [Response_ResponseCode.RespUserLevelTooLow]: 'JoinGameError.registeredOnly',
  [Response_ResponseCode.RespInIgnoreList]: 'JoinGameError.ignored',
};

export function useJoinGameErrorMessage(error: {
  code: number; message?: string; failure?: WebsocketTypes.CommandFailure;
} | null): string {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  if (!error) {
    return '';
  }
  const key = ERROR_KEYS[error.code as Response_ResponseCode];
  return describeFailure(error.failure, key ? t(key) : (error.message || t('JoinGameError.failed')));
}
