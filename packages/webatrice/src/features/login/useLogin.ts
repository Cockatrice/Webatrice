import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@app/components';
import { useFireOnce, useReduxEffect } from '@app/hooks';
import { useKnownHosts } from '@app/feature-widgets/known-hosts';
import { useWebClient } from '@cockatrice/datatrice/react';
import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { getHostKey, getHostPort } from '@app/utils';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';

import type { LoginFormValues } from './forms/LoginForm/LoginForm';
import type { RegisterFormValues } from './forms/RegisterForm/RegisterForm';
import type { RequestPasswordResetFormValues } from './forms/RequestPasswordResetForm/RequestPasswordResetForm';
import type { ResetPasswordFormValues } from './forms/ResetPasswordForm/ResetPasswordForm';
import { loginAttempt, useLoginAttemptFailed } from './loginAttempt';
import { useAutoLogin } from './useAutoLogin';
import { persistLoginCredentials } from './persistLoginCredentials';
import { autoLoginGate } from '../../services/session/autoLoginGate';

export interface LoginDialogState {
  passwordResetRequestDialog: boolean;
  resetPasswordDialog: boolean;
  registrationDialog: boolean;
  activationDialog: boolean;
}

export interface Login {
  description: string | undefined;
  passwordChangeRequired: boolean;
  loginFailed: boolean;
  isConnected: boolean;
  dialogState: LoginDialogState;
  userToResetPassword: string | null;
  submitButtonDisabled: boolean;
  handleLogin: (form: LoginFormValues) => void;
  showDescription: () => boolean;
  handleRegistrationDialogSubmit: (form: RegisterFormValues) => void;
  handleAccountActivationDialogSubmit: (args: { token: string }) => void;
  handleRequestPasswordResetDialogSubmit: (form: RequestPasswordResetFormValues) => void;
  handleResetPasswordDialogSubmit: (form: ResetPasswordFormValues) => void;
  skipTokenRequest: (userName: string) => void;
  closeRequestPasswordResetDialog: () => void;
  openRequestPasswordResetDialog: () => void;
  closeResetPasswordDialog: () => void;
  closeRegistrationDialog: () => void;
  openRegistrationDialog: () => void;
  closeActivateAccountDialog: () => void;
}

const LOGIN_FAILURE_MESSAGE_KEYS: Partial<Record<number, string>> = {
  [Response_ResponseCode.RespPasswordChangeRequired]: 'Login.status.passwordChangeRequired',
  [Response_ResponseCode.RespServerFull]: 'Login.status.serverFull',
};

export function useLogin(): Login {
  const rawDescription = useAppSelector((s) => server.Selectors.getDescription(s));
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const connectionAttemptMade = useAppSelector(server.Selectors.getConnectionAttemptMade);
  const connectUnreachable = useAppSelector(server.Selectors.getConnectUnreachable);
  const loginFailureCode = useAppSelector(server.Selectors.getLoginFailureCode);
  const webClient = useWebClient();
  const { t } = useTranslation();

  const loginFailureKey = loginFailureCode === null ? undefined : LOGIN_FAILURE_MESSAGE_KEYS[loginFailureCode];
  const passwordChangeRequired =
    !isConnected && loginFailureCode === Response_ResponseCode.RespPasswordChangeRequired;
  let description = rawDescription;
  if (!isConnected && connectUnreachable) {
    description = t('Login.status.serverUnreachable');
  } else if (!isConnected && loginFailureKey) {
    description = t(loginFailureKey);
  }

  const [pendingActivationOptions, setPendingActivationOptions] =
    useState<WebsocketTypes.PendingActivationContext | null>(null);

  const rememberLoginRef = useRef<LoginFormValues | RegisterFormValues | null>(null);
  const pendingActivationPasswordRef = useRef<string | undefined>(undefined);
  const knownHosts = useKnownHosts();
  const selectedHost = knownHosts.value?.selectedHost;
  const attemptFailed = useLoginAttemptFailed(selectedHost ? getHostKey(selectedHost) : null);
  const loginFailed = !isConnected && attemptFailed;
  const [dialogState, setDialogState] = useState<LoginDialogState>({
    passwordResetRequestDialog: false,
    resetPasswordDialog: false,
    registrationDialog: false,
    activationDialog: false,
  });
  const [userToResetPassword, setUserToResetPassword] = useState<string | null>(null);

  const passwordResetToast = useToast({
    key: 'password-reset-success',
    children: t('Login.toasts.passwordResetSuccessToast'),
  });
  const accountActivatedToast = useToast({
    key: 'account-activation-success',
    children: t('Login.toasts.accountActivationSuccess'),
  });

  const closeRequestPasswordResetDialog = () => {
    setDialogState((s) => ({ ...s, passwordResetRequestDialog: false }));
  };

  const openRequestPasswordResetDialog = () => {
    setDialogState((s) => ({ ...s, passwordResetRequestDialog: true }));
  };

  const closeResetPasswordDialog = () => {
    setDialogState((s) => ({ ...s, resetPasswordDialog: false }));
  };

  const openResetPasswordDialog = () => {
    setDialogState((s) => ({ ...s, resetPasswordDialog: true }));
  };

  const closeRegistrationDialog = () => {
    setDialogState((s) => ({ ...s, registrationDialog: false }));
  };

  const openRegistrationDialog = () => {
    setDialogState((s) => ({ ...s, registrationDialog: true }));
  };

  const closeActivateAccountDialog = () => {
    pendingActivationPasswordRef.current = undefined;
    setDialogState((s) => ({ ...s, activationDialog: false }));
  };

  const openActivateAccountDialog = () => {
    setDialogState((s) => ({ ...s, activationDialog: true }));
  };

  useReduxEffect(() => {
    closeRequestPasswordResetDialog();
    openResetPasswordDialog();
  }, server.Types.RESET_PASSWORD_REQUESTED, []);

  useReduxEffect(() => {
    passwordResetToast.openToast();
    closeResetPasswordDialog();
  }, server.Types.RESET_PASSWORD_SUCCESS, []);

  useReduxEffect(() => {
    accountActivatedToast.openToast();
    closeActivateAccountDialog();
    setPendingActivationOptions(null);
  }, server.Types.ACCOUNT_ACTIVATION_SUCCESS, []);

  useReduxEffect<{ options: WebsocketTypes.PendingActivationContext }>(({ payload: { options } }) => {
    setPendingActivationOptions(options);
    pendingActivationPasswordRef.current = rememberLoginRef.current?.password || undefined;
    closeRegistrationDialog();
    openActivateAccountDialog();
  }, server.Types.ACCOUNT_AWAITING_ACTIVATION, []);

  const onSubmitLogin = useCallback((loginForm: LoginFormValues) => {
    autoLoginGate.hasChecked = true;
    rememberLoginRef.current = loginForm;
    const { userName, password, selectedHost, remember } = loginForm;

    const options: Omit<WebsocketTypes.LoginConnectOptions, 'reason'> = {
      ...getHostPort(selectedHost),
      userName,
      password,
    };

    if (remember && !password) {
      options.hashedPassword = selectedHost.hashedPassword;
    }

    loginAttempt.started(getHostKey(selectedHost));
    webClient.request.authentication.login(options);
  }, [webClient]);

  const [submitButtonDisabled, resetSubmitButton, handleLogin] = useFireOnce(onSubmitLogin);

  useReduxEffect(() => {
    resetSubmitButton();
    loginAttempt.failed();
  }, [server.Types.CONNECTION_FAILED, server.Types.LOGIN_FAILED, server.Actions.connectUnreachable.type], []);

  useReduxEffect<{ options: WebsocketTypes.LoginSuccessContext }>(({ payload: { options } }) => {
    const loginForm = rememberLoginRef.current;
    if (loginForm && 'remember' in loginForm) {
      persistLoginCredentials(options.hashedPassword, loginForm, knownHosts.update);
    }
    rememberLoginRef.current = null;
    loginAttempt.succeeded();
  }, server.Types.LOGIN_SUCCESSFUL, []);

  useAutoLogin(handleLogin, connectionAttemptMade);

  const showDescription = () => {
    return Boolean(!isConnected && description?.length);
  };

  const handleRegistrationDialogSubmit = (registerForm: RegisterFormValues) => {
    rememberLoginRef.current = registerForm;
    const { userName, password, email, country, realName, selectedHost } = registerForm;

    webClient.request.authentication.register({
      ...getHostPort(selectedHost),
      userName,
      password,
      email,
      country: country.toLowerCase(),
      realName,
    });
  };

  const handleAccountActivationDialogSubmit = ({ token }: { token: string }) => {
    if (!pendingActivationOptions) {
      return;
    }
    webClient.request.authentication.activateAccount({
      host: pendingActivationOptions.host,
      port: pendingActivationOptions.port,
      userName: pendingActivationOptions.userName,
      token,
      password: pendingActivationPasswordRef.current,
    });
  };

  const handleRequestPasswordResetDialogSubmit = (form: RequestPasswordResetFormValues) => {
    const { userName, email, selectedHost } = form;
    const { host, port } = getHostPort(selectedHost);

    if (email) {
      webClient.request.authentication.resetPasswordChallenge({ userName, email, host, port });
    } else {
      setUserToResetPassword(userName);
      webClient.request.authentication.resetPasswordRequest({ userName, host, port });
    }
  };

  const handleResetPasswordDialogSubmit = ({
    userName,
    token,
    newPassword,
    selectedHost,
  }: ResetPasswordFormValues) => {
    const { host, port } = getHostPort(selectedHost);
    webClient.request.authentication.resetPassword({ userName, token, newPassword, host, port });
  };

  const skipTokenRequest = (userName: string) => {
    setUserToResetPassword(userName);

    setDialogState((s) => ({
      ...s,
      passwordResetRequestDialog: false,
      resetPasswordDialog: true,
    }));
  };

  return {
    description,
    passwordChangeRequired,
    loginFailed,
    isConnected,
    dialogState,
    userToResetPassword,
    submitButtonDisabled,
    handleLogin,
    showDescription,
    handleRegistrationDialogSubmit,
    handleAccountActivationDialogSubmit,
    handleRequestPasswordResetDialogSubmit,
    handleResetPasswordDialogSubmit,
    skipTokenRequest,
    closeRequestPasswordResetDialog,
    openRequestPasswordResetDialog,
    closeResetPasswordDialog,
    closeRegistrationDialog,
    openRegistrationDialog,
    closeActivateAccountDialog,
  };
}
