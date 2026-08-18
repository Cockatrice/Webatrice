import { useEffect, useRef } from 'react';
import { useForm, Controller, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

import { CheckboxField, InputField } from '@app/components';
import { KnownHosts, useKnownHosts } from '@app/feature-widgets/known-hosts';
import { LoadingState, useSettings } from '@app/hooks';
import { HostDTO } from '@app/services';
import { server, type TestConnectionStatus } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { useLoginFormBody } from './useLoginForm';
import { buildLoginFormSchema, type LoginFormValues } from './loginFormSchema';

export type { LoginFormValues };

// @critical Remember/Auto Connect gate hides options until test-connection proves hashing support
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
  // @critical login requires a successful test-connection — re-disables on every re-test
  const loginDisabled = disableSubmitButton || testConnectionStatus !== 'success';

  const submit = handleSubmit((values) => {
    onSubmit({ ...values, userName: values.userName?.trim() });
  });

  return (
    <form className="w-full space-y-4" onSubmit={submit}>
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

      <Controller
        name="password"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            {...field}
            onFocus={() => setUseStoredPasswordLabel(false)}
            onBlur={(e) => {
              field.onBlur();
              passwordFieldBlur();
              // Keep the RHF onBlur signature consumers might expect.
              e.currentTarget.blur();
            }}
            label={useStoredPasswordLabel ? STORED_PASSWORD_LABEL : PASSWORD_LABEL}
            type="password"
            autoComplete="new-password"
            error={fieldState.error?.message}
            touched={fieldState.isTouched}
          />
        )}
      />

      <div className="flex items-center justify-between">
        {showHashingGatedOptions ? (
          <Controller
            name="remember"
            control={control}
            render={({ field }) => (
              <CheckboxField {...field} label={t('LoginForm.label.savePassword')} />
            )}
          />
        ) : (
          <span aria-hidden />
        )}

        <button
          type="button"
          onClick={onResetPassword}
          className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
        >
          {t('LoginForm.label.forgot')}
        </button>
      </div>

      <div>
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
        <div>
          <Controller
            name="autoConnect"
            control={control}
            render={({ field }) => (
              <CheckboxField {...field} label={t('LoginForm.label.autoConnect')} />
            )}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loginDisabled}
        className={[
          'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold text-white transition-colors',
          loginDisabled
            ? 'bg-bg-elevated text-text-muted cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover shadow-glow',
        ].join(' ')}
      >
        {t('LoginForm.label.login')}
      </button>
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
      <div className="flex justify-center py-10">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  return <LoginFormBody {...props} form={form} />;
};

export default LoginForm;
