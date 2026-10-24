import { useEffect, useRef } from 'react';
import { useForm, Controller, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';

import { Button } from '@app/components';
import { KnownHosts, useKnownHosts } from '@app/feature-widgets/known-hosts';
import { LoadingState, useSettings } from '@app/hooks';
import { HostDTO } from '@app/services';
import { server, type TestConnectionStatus } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { useLoginFormBody } from './useLoginForm';
import LoginField from './LoginField';
import LoginCheckbox from './LoginCheckbox';
import { useLoginProgress } from '../../useLoginProgress';
import type { LoginPhase, LoginStepId, LoginStepState } from '../../loginProgress';
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
  failed?: boolean;
}

const PHASE_KEYS: Record<LoginPhase, string> = {
  noServer: 'LoginForm.phase.noServer',
  testing: 'LoginForm.phase.testing',
  unreachable: 'LoginForm.phase.unreachable',
  ready: 'LoginForm.label.login',
  connecting: 'LoginForm.phase.connecting',
  signingIn: 'LoginForm.phase.signingIn',
  entering: 'LoginForm.phase.entering',
};

const STEP_KEYS: Record<`${LoginStepId}:${LoginStepState}`, string> = {
  'server:pending': 'LoginForm.steps.server',
  'server:current': 'LoginForm.steps.serverTesting',
  'server:done': 'LoginForm.steps.serverReachable',
  'server:failed': 'LoginForm.steps.serverUnreachable',
  'signIn:pending': 'LoginForm.steps.signIn',
  'signIn:current': 'LoginForm.steps.signingIn',
  'signIn:done': 'LoginForm.steps.signedIn',
  'signIn:failed': 'LoginForm.steps.signInFailed',
  'lobby:pending': 'LoginForm.steps.lobby',
  'lobby:current': 'LoginForm.steps.lobbyOpening',
  'lobby:done': 'LoginForm.steps.lobby',
  'lobby:failed': 'LoginForm.steps.lobby',
};

const STEP_TONE: Record<LoginStepState, string> = {
  pending: 'text-text-muted',
  current: 'text-text-primary',
  done: 'text-success',
  failed: 'text-danger',
};

function StepIcon({ state }: { state: LoginStepState }) {
  if (state === 'done') {
    return <Check size={12} aria-hidden />;
  }
  if (state === 'failed') {
    return <X size={12} aria-hidden />;
  }
  if (state === 'current') {
    return <Loader2 size={12} className="animate-spin" aria-hidden />;
  }
  return null;
}

interface LoginFormBodyProps extends LoginFormProps {
  form: UseFormReturn<LoginFormValues>;
}

const LoginFormBody = ({
  form,
  disableSubmitButton,
  onResetPassword,
  onSubmit,
  failed = false,
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
    // Fire on a host change only: lastHostRef dedupes, and the handler reads settings at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [formHost]);

  useEffect(() => {
    onUserNameChange(formUserName);
    // Fire on a username change only: re-firing when selectedHost changes would compare the new
    // host against the old username and invalidate the new host's stored hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [formUserName]);

  useEffect(() => {
    onRememberChange(formRemember);
    // Fire on a remember toggle only: re-firing on a host change would override the password
    // label onSelectedHostChange just set.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [formRemember]);

  const testConnectionStatus = useAppSelector(server.Selectors.getTestConnectionStatus);
  const showHashingGatedOptions = hostSupportsHashedPassword(selectedHost, testConnectionStatus);
  // @critical login requires a successful test-connection — re-disables on every re-test
  const loginDisabled = disableSubmitButton || testConnectionStatus !== 'success';

  const submit = handleSubmit((values) => {
    onSubmit({ ...values, userName: values.userName?.trim() });
  });

  const progress = useLoginProgress({
    hasServer: Boolean(formHost),
    submitting: disableSubmitButton,
    failed,
  });

  return (
    <form className="flex w-full flex-col" onSubmit={submit}>
      <Controller
        name="selectedHost"
        control={control}
        render={({ field, fieldState }) => (
          <KnownHosts
            variant="summary"
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            touched={fieldState.isTouched}
          />
        )}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Controller
          name="userName"
          control={control}
          render={({ field, fieldState }) => (
            <LoginField
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
            <LoginField
              {...field}
              onFocus={() => setUseStoredPasswordLabel(false)}
              onBlur={(e) => {
                field.onBlur();
                passwordFieldBlur();
                e.currentTarget.blur();
              }}
              label={useStoredPasswordLabel ? STORED_PASSWORD_LABEL : PASSWORD_LABEL}
              type="password"
              revealable
              autoComplete="new-password"
              error={fieldState.error?.message}
              touched={fieldState.isTouched}
            />
          )}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        {showHashingGatedOptions && (
          <>
            <Controller
              name="remember"
              control={control}
              render={({ field }) => (
                <LoginCheckbox {...field} label={t('LoginForm.label.savePassword')} />
              )}
            />
            <Controller
              name="autoConnect"
              control={control}
              render={({ field }) => (
                <LoginCheckbox
                  {...field}
                  label={t('LoginForm.label.autoConnect')}
                  onChange={(e) => onUserToggleAutoConnect(e.target.checked, field.onChange)}
                />
              )}
            />
          </>
        )}

        <button
          type="button"
          onClick={onResetPassword}
          className={[
            'ml-auto rounded-ui-sm font-medium text-accent hover:underline',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          ].join(' ')}
        >
          {t('LoginForm.label.forgot')}
        </button>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={loginDisabled}
        className="mt-4 w-full text-[15px] disabled:!opacity-100 disabled:bg-accent/20 disabled:text-text-primary"
        icon={progress.busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : undefined}
        iconRight={progress.canSubmit ? <ArrowRight size={17} aria-hidden /> : undefined}
      >
        {t(PHASE_KEYS[progress.phase])}
      </Button>

      <ol
        aria-label={t('LoginForm.steps.label')}
        className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11.5px] text-text-muted"
      >
        {progress.steps.map((step, i) => (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={['flex items-center gap-1', STEP_TONE[step.state]].join(' ')}
          >
            {i > 0 && <span aria-hidden className="mr-1 text-text-muted">·</span>}
            <StepIcon state={step.state} />
            {t(STEP_KEYS[`${step.id}:${step.state}`])}
          </li>
        ))}
      </ol>
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
