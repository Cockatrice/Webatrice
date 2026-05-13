import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useToast } from '@app/components';
import { useReduxEffect } from '@app/hooks';
import { server } from 'datatrice';

export interface RegisterForm {
  emailRequired: boolean;
  emailError: string | null;
  passwordError: string | null;
  userNameError: string | null;
  error: string | null;
  onHostChange: () => void;
  onEmailChange: () => void;
  onPasswordChange: () => void;
  onUserNameChange: () => void;
}

export function useRegisterForm(): RegisterForm {
  const { t } = useTranslation();
  const [emailRequired, setEmailRequired] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [userNameError, setUserNameError] = useState<string | null>(null);
  const error = useSelector(server.Selectors.getRegistrationError);
  const { openToast } = useToast({
    key: 'registration-success',
    children: t('RegisterForm.toast.registerSuccess'),
  });

  const onHostChange = () => setEmailRequired(false);
  const onEmailChange = () => emailError && setEmailError(null);
  const onPasswordChange = () => passwordError && setPasswordError(null);
  const onUserNameChange = () => userNameError && setUserNameError(null);

  useReduxEffect(() => {
    setEmailRequired(true);
  }, server.Types.REGISTRATION_REQUIRES_EMAIL);

  useReduxEffect(() => {
    openToast();
  }, server.Types.REGISTRATION_SUCCESS);

  useReduxEffect<{ error: string }>(({ payload: { error } }) => {
    setEmailError(error);
  }, server.Types.REGISTRATION_EMAIL_ERROR);

  useReduxEffect<{ error: string }>(({ payload: { error } }) => {
    setPasswordError(error);
  }, server.Types.REGISTRATION_PASSWORD_ERROR);

  useReduxEffect<{ error: string }>(({ payload: { error } }) => {
    setUserNameError(error);
  }, server.Types.REGISTRATION_USERNAME_ERROR);

  return {
    emailRequired,
    emailError,
    passwordError,
    userNameError,
    error,
    onHostChange,
    onEmailChange,
    onPasswordChange,
    onUserNameChange,
  };
}
