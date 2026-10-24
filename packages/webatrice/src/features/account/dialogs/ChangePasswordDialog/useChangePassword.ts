import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePushToast } from '@app/components';
import { useCommandFailureMessage, useRequestTracker } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';

import { changePasswordErrorMessage } from '../accountResponseMessages';
import type { ChangePasswordFormValues } from './changePasswordFormSchema';

export interface ChangePassword {
  pending: boolean;
  error: string | null;
  submit: (values: ChangePasswordFormValues) => void;
}

export function useChangePassword(onDone: () => void): ChangePassword {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const pushToast = usePushToast();
  const failureMessage = useCommandFailureMessage();
  const request = useRequestTracker();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async ({ oldPassword, newPassword }: ChangePasswordFormValues) => {
    const requestId = request.begin();
    setPending(true);
    setError(null);
    try {
      await webClient.request.session.accountPassword(
        oldPassword,
        newPassword,
        () => {
          if (!request.isCurrent(requestId)) {
            return;
          }
          request.cancel();
          setPending(false);
          pushToast(t('ChangePasswordDialog.success'));
          onDone();
        },
        (responseCode, failure) => {
          if (!request.isCurrent(requestId)) {
            return;
          }
          request.cancel();
          setPending(false);
          setError(failureMessage(failure, changePasswordErrorMessage(t, responseCode)));
        },
      );
    } catch {
      if (!request.isCurrent(requestId)) {
        return;
      }
      request.cancel();
      setPending(false);
      setError(t('AccountDialogs.error.updateFailed'));
    }
  };

  return { pending, error, submit };
}
