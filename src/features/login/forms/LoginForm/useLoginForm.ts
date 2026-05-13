import { useState } from 'react';
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form';

import { LoadingState, useKnownHosts, useSettings } from '@app/hooks';
import { HostDTO } from '@app/services';

import type { LoginFormValues } from './loginFormSchema';

export interface LoginFormBody {
  selectedHost: HostDTO | undefined;
  useStoredPasswordLabel: boolean;
  setUseStoredPasswordLabel: (v: boolean) => void;
  onSelectedHostChange: (host: HostDTO | undefined) => void;
  onUserNameChange: (userName: string | undefined) => void;
  onRememberChange: (checked: boolean) => void;
  onUserToggleAutoConnect: (checked: boolean, fieldOnChange: (v: boolean) => void) => void;
  passwordFieldBlur: () => void;
}

interface UseLoginFormBodyArgs {
  setValue: UseFormSetValue<LoginFormValues>;
  getValues: UseFormGetValues<LoginFormValues>;
}

export function useLoginFormBody({ setValue, getValues }: UseLoginFormBodyArgs): LoginFormBody {
  const settings = useSettings();
  const hosts = useKnownHosts();

  const selectedHost = hosts.status === LoadingState.READY ? hosts.value?.selectedHost : undefined;

  const [useStoredPasswordLabel, setUseStoredPasswordLabel] = useState(false);
  const [storedHashInvalidated, setStoredHashInvalidated] = useState(false);

  const canUseStoredPassword = (remember: boolean, password: string | undefined) =>
    Boolean(remember && selectedHost?.hashedPassword && !password && !storedHashInvalidated);

  const togglePasswordLabel = (on: boolean) => setUseStoredPasswordLabel(on);

  // @critical Host-sync normally must not touch autoConnect — it's an app-level
  // setting, not per-host. The single exception is switching to a host that is
  // *proven* naked (supportsHashedPassword === false): the Remember/AutoConnect
  // UI is hidden there, so we also clear the persisted setting to prevent a
  // stale `true` from surviving silently. `undefined` (fresh host, test not
  // yet complete) leaves the preference alone — test-connection will resolve
  // capability in milliseconds.
  const onSelectedHostChange = (host: HostDTO | undefined) => {
    if (!host) {
      return;
    }
    const nakedServer = host.supportsHashedPassword === false;
    setValue('userName', host.userName ?? '');
    setValue('password', '');
    setValue('remember', !nakedServer && Boolean(host.remember));
    setStoredHashInvalidated(false);
    togglePasswordLabel(!nakedServer && Boolean(host.remember && host.hashedPassword));

    if (nakedServer) {
      setValue('autoConnect', false);
      if (settings.status === LoadingState.READY && settings.value?.autoConnect) {
        void settings.update({ autoConnect: false });
      }
    }
  };

  const onUserNameChange = (userName: string | undefined) => {
    const { remember, password } = getValues();
    const fieldChanged = selectedHost?.userName?.toLowerCase() !== userName?.toLowerCase();
    if (canUseStoredPassword(remember, password) && fieldChanged) {
      setStoredHashInvalidated(true);
    }
  };

  const onRememberChange = (checked: boolean) => {
    // @critical Writes form-only, never to persisted setting — "remember" toggle isn't a preference edit.
    const { autoConnect, password } = getValues();
    if (!checked && autoConnect) {
      setValue('autoConnect', false);
    }

    togglePasswordLabel(canUseStoredPassword(checked, password));
  };

  // @critical Only persist-path for autoConnect; called from native onChange,
  // not from a watcher, to avoid leaking setValue() writes into Dexie.
  const onUserToggleAutoConnect = (checked: boolean, fieldOnChange: (v: boolean) => void) => {
    fieldOnChange(checked);

    if (settings.status === LoadingState.READY) {
      void settings.update({ autoConnect: checked });
    }

    const { remember } = getValues();
    if (checked && !remember) {
      setValue('remember', true);
    }
  };

  const passwordFieldBlur = () => {
    const { remember, password } = getValues();
    togglePasswordLabel(canUseStoredPassword(remember, password));
  };

  return {
    selectedHost,
    useStoredPasswordLabel,
    setUseStoredPasswordLabel,
    onSelectedHostChange,
    onUserNameChange,
    onRememberChange,
    onUserToggleAutoConnect,
    passwordFieldBlur,
  };
}
