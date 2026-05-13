import { useEffect, useRef } from 'react';
import { useForm, Controller, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { CheckboxField, InputField } from '@app/components';
import { KnownHosts } from '@app/feature-widgets/known-hosts';
import { LoadingState, useKnownHosts, useSettings } from '@app/hooks';
import { HostDTO } from '@app/services';
import { server, type TestConnectionStatus } from 'datatrice';
import { useAppSelector } from '@app/store';
import { useLoginFormBody } from './useLoginForm';
import { buildLoginFormSchema, type LoginFormValues } from './loginFormSchema';

import './LoginForm.css';

export type { LoginFormValues };

// Remember Password and Auto Connect both require server-side password hashing
// to be useful (no hash to save = nothing to resume with). Test-connection
// captures capability from ServerIdentification before the user ever logs in,
// so we can afford a strict "hidden until a completed test proves supported" gate.
const hostSupportsHashedPassword = (
  host: HostDTO | undefined,
  testConnectionStatus: TestConnectionStatus,
): boolean =>
  testConnectionStatus === 'success' && host?.supportsHashedPassword === true;

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => void;
  disableSubmitButton: boolean;
  onResetPassword: () => void;
}

interface LoginFormBodyProps extends LoginFormProps {
  form: UseFormReturn<LoginFormValues>;
}

const LoginFormBody = ({
  form,
  disableSubmitButton,
  onResetPassword,
  onSubmit,
}: LoginFormBodyProps) => {
  const { t } = useTranslation();
  const PASSWORD_LABEL = t('Common.label.password');
  const STORED_PASSWORD_LABEL = t('LoginForm.label.savedPassword');

  const { control, handleSubmit, setValue, getValues, watch } = form;

  const {
    selectedHost,
    useStoredPasswordLabel,
    setUseStoredPasswordLabel,
    onSelectedHostChange,
    onUserNameChange,
    onRememberChange,
    onUserToggleAutoConnect,
    passwordFieldBlur,
  } = useLoginFormBody({ setValue, getValues });

  // Watched values drive the side-effect listeners. Each useEffect fires on
  // mount (matching RFF's react-final-form-listeners OnChange semantics —
  // initial undefined → defined transition triggers the handler) and on
  // every subsequent change.
  const formHost = watch('selectedHost');
  const formUserName = watch('userName');
  const formRemember = watch('remember');

  const lastHostRef = useRef<HostDTO | undefined>(undefined);
  useEffect(() => {
    if (formHost === lastHostRef.current) {
      return;
    }
    lastHostRef.current = formHost;
    onSelectedHostChange(formHost);
  }, [formHost]);

  useEffect(() => {
    onUserNameChange(formUserName);
  }, [formUserName]);

  useEffect(() => {
    onRememberChange(formRemember);
  }, [formRemember]);

  const testConnectionStatus = useAppSelector(server.Selectors.getTestConnectionStatus);
  const showHashingGatedOptions = hostSupportsHashedPassword(selectedHost, testConnectionStatus);
  // Login is only meaningful once we know the host is reachable + speaks the
  // Cockatrice protocol. Keep the button disabled until test-connection resolves
  // to 'success'; re-disable on any subsequent re-test.
  const loginDisabled = disableSubmitButton || testConnectionStatus !== 'success';

  const submit = handleSubmit((values) => {
    onSubmit({ ...values, userName: values.userName?.trim() });
  });

  return (
    <form className="loginForm" onSubmit={submit}>
      <div className="loginForm-items">
        <div className="loginForm-item">
          <Controller
            name="userName"
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label={t('Common.label.username')}
                autoComplete="username"
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </div>
        <div className="loginForm-item">
          <Controller
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                onFocus={() => setUseStoredPasswordLabel(false)}
                onBlur={() => {
                  field.onBlur(); passwordFieldBlur();
                }}
                label={useStoredPasswordLabel ? STORED_PASSWORD_LABEL : PASSWORD_LABEL}
                type="password"
                autoComplete="new-password"
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </div>
        <div className="loginForm-actions">
          {showHashingGatedOptions && (
            <Controller
              name="remember"
              control={control}
              render={({ field }) => (
                <CheckboxField {...field} label={t('LoginForm.label.savePassword')} />
              )}
            />
          )}

          <Button color="primary" onClick={onResetPassword}>
            {t('LoginForm.label.forgot')}
          </Button>
        </div>
        <div className="loginForm-item">
          <Controller
            name="selectedHost"
            control={control}
            render={({ field, fieldState }) => (
              <KnownHosts
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </div>
        {showHashingGatedOptions && (
          <div className="loginForm-actions">
            <Controller
              name="autoConnect"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  className="checkbox-field"
                  label={t('LoginForm.label.autoConnect')}
                  control={
                    <Checkbox
                      className="checkbox-field__box"
                      checked={!!field.value}
                      onChange={(_e, checked) => onUserToggleAutoConnect(checked, field.onChange)}
                      color="primary"
                    />
                  }
                />
              )}
            />
          </div>
        )}
      </div>
      <Button
        className="loginForm-submit rounded tall"
        color="primary"
        variant="contained"
        type="submit"
        disabled={loginDisabled}
      >
        {t('LoginForm.label.login')}
      </Button>
    </form>
  );
};

const LoginForm = (props: LoginFormProps) => {
  const { t } = useTranslation();
  const knownHosts = useKnownHosts();
  const settings = useSettings();

  const form = useForm<LoginFormValues>({
    defaultValues: {
      userName: knownHosts.value?.selectedHost?.userName ?? '',
      password: '',
      remember: Boolean(knownHosts.value?.selectedHost?.remember),
      autoConnect: Boolean(settings.value?.autoConnect),
      selectedHost: knownHosts.value?.selectedHost as HostDTO,
    },
    resolver: zodResolver(buildLoginFormSchema(t)),
  });

  if (knownHosts.status !== LoadingState.READY || settings.status !== LoadingState.READY) {
    return (
      <div className="loginForm-loading">
        <CircularProgress size={40} />
      </div>
    );
  }

  return <LoginFormBody {...props} form={form} />;
};

export default LoginForm;
