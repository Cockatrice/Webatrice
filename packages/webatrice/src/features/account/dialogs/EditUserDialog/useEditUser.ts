import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePushToast } from '@app/components';
import { useCommandFailureMessage, useReduxEffect, useRequestTracker } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

import { editUserErrorMessage } from '../accountResponseMessages';
import { needsPasswordCheck, type EditUserFormValues } from './editUserFormSchema';

export type EditUserProfile = Omit<EditUserFormValues, 'passwordCheck'>;

export interface EditUser {
  profile: EditUserProfile | null;
  supportsPasswordHash: boolean | undefined;
  pending: boolean;
  error: string | null;
  submit: (values: EditUserFormValues) => void;
}

export function useEditUser(onDone: () => void): EditUser {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const pushToast = usePushToast();
  const failureMessage = useCommandFailureMessage();
  const request = useRequestTracker();
  const user = useAppSelector(server.Selectors.getUser);
  const supportsPasswordHash = useAppSelector(server.Selectors.getSupportsPasswordHash);
  const [profile, setProfile] = useState<EditUserProfile | null>(null);
  const waitingForProfile = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useReduxEffect<{ userInfo: ServerInfo_User }>(({ payload: { userInfo } }) => {
    if (!waitingForProfile.current || userInfo.name !== user?.name) {
      return;
    }
    waitingForProfile.current = false;
    setProfile({
      email: userInfo.email ?? '',
      country: (userInfo.country ?? '').toUpperCase(),
      realName: userInfo.realName ?? '',
    });
  }, server.Types.GET_USER_INFO);

  useReduxEffect<{ userName: string }>(({ payload: { userName } }) => {
    if (!waitingForProfile.current || (userName !== '' && userName !== user?.name)) {
      return;
    }
    waitingForProfile.current = false;
    setError(t('EditUserDialog.fetchFailed'));
  }, server.Types.GET_USER_INFO_FAILED);

  useEffect(() => {
    waitingForProfile.current = true;
    webClient.request.session.getUserInfo('');
    return () => {
      waitingForProfile.current = false;
    };
  }, [webClient]);

  const submit = ({ email, country, realName, passwordCheck }: EditUserFormValues) => {
    if (!profile || pending) {
      return;
    }
    const emailEdit = supportsPasswordHash === false
      ? { email }
      : (needsPasswordCheck(email, { originalEmail: profile.email, supportsPasswordHash }) ? { email, passwordCheck } : {});

    const requestId = request.begin();
    setPending(true);
    setError(null);
    webClient.request.session.accountEdit(
      { realName, country: country.toLowerCase(), ...emailEdit },
      () => {
        if (!request.isCurrent(requestId)) {
          return;
        }
        request.cancel();
        setPending(false);
        pushToast(t('EditUserDialog.success'));
        onDone();
      },
      (responseCode, failure) => {
        if (!request.isCurrent(requestId)) {
          return;
        }
        request.cancel();
        setPending(false);
        setError(failureMessage(failure, editUserErrorMessage(t, responseCode)));
      },
    );
  };

  return { profile, supportsPasswordHash, pending, error, submit };
}
