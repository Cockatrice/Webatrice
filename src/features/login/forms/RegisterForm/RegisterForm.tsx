import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { CountryDropdown, InputField } from '@app/components';
import { KnownHosts } from '@app/feature-widgets/known-hosts';
import type { HostDTO } from '@app/services';
import { server } from 'datatrice';
import { useAppDispatch } from '@app/store';
import { useRegisterForm } from './useRegisterForm';
import {
  buildRegisterFormSchema,
  type RegisterFormValues,
} from './registerFormSchema';

import './RegisterForm.css';

export type { RegisterFormValues };

interface RegisterFormProps {
  onSubmit: (values: RegisterFormValues) => void;
}

const RegisterForm = ({ onSubmit }: RegisterFormProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const {
    emailRequired,
    emailError,
    passwordError,
    userNameError,
    error,
    onHostChange,
    onEmailChange,
    onPasswordChange,
    onUserNameChange,
  } = useRegisterForm();

  const schema = useMemo(() => buildRegisterFormSchema(t, emailRequired), [t, emailRequired]);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    getValues,
    watch,
  } = useForm<RegisterFormValues>({
    defaultValues: {
      userName: '',
      password: '',
      passwordConfirm: '',
      email: '',
      emailConfirm: '',
      realName: '',
      country: '',
      selectedHost: undefined as unknown as HostDTO,
    },
    resolver: zodResolver(schema),
  });

  // Mirror server-driven errors onto the form once the field has been seen.
  // useReduxEffect populates the *Error state in useRegisterForm; pushing them
  // into formState via setError gives Controller's fieldState.error a value.
  useEffect(() => {
    if (emailError) {
      setError('email', { type: 'server', message: emailError });
    }
  }, [emailError, setError]);
  useEffect(() => {
    if (userNameError) {
      setError('userName', { type: 'server', message: userNameError });
    }
  }, [userNameError, setError]);
  useEffect(() => {
    if (passwordError) {
      setError('password', { type: 'server', message: passwordError });
    }
  }, [passwordError, setError]);

  // When the server demands MFA mid-flow, force-touch + re-validate email so
  // the "required" error surfaces immediately. Replaces RFF's
  // `form.mutators.setFieldTouched('email', true)` pattern.
  useEffect(() => {
    if (emailRequired) {
      setValue('email', getValues('email') ?? '', { shouldTouch: true, shouldValidate: true });
    }
  }, [emailRequired, setValue, getValues]);

  // Watch + useEffect replaces react-final-form-listeners <OnChange>: each
  // listener mirrors the old "clear server error when user starts editing"
  // behavior. Hook deps include the watched value only — the underlying
  // callbacks read state via closures, matching the prior semantics.
  const formUserName = watch('userName');
  const formPassword = watch('password');
  const formEmail = watch('email');
  const formHost = watch('selectedHost');
  useEffect(() => {
    onUserNameChange();
  }, [formUserName, onUserNameChange]);
  useEffect(() => {
    onPasswordChange();
  }, [formPassword, onPasswordChange]);
  useEffect(() => {
    onEmailChange();
  }, [formEmail, onEmailChange]);
  useEffect(() => {
    onHostChange();
  }, [formHost, onHostChange]);

  const submit = handleSubmit((values) => {
    dispatch(server.Actions.clearRegistrationErrors());
    onSubmit({
      ...values,
      userName: values.userName?.trim(),
      email: values.email?.trim(),
      realName: values.realName?.trim(),
    });
  });

  return (
    <>
      <form className="RegisterForm" onSubmit={submit}>
        <div className="RegisterForm-column">
          <div className="RegisterForm-item">
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
          <div className="RegisterForm-item">
            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  {...field}
                  label={t('Common.label.password')}
                  type="password"
                  autoComplete='new-password'
                  error={fieldState.error?.message}
                  touched={fieldState.isTouched}
                />
              )}
            />
          </div>
          <div className="RegisterForm-item">
            <Controller
              name="passwordConfirm"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  {...field}
                  label={t('Common.label.confirmPassword')}
                  type="password"
                  autoComplete='new-password'
                  error={fieldState.error?.message}
                  touched={fieldState.isTouched}
                />
              )}
            />
          </div>
          <div className="RegisterForm-item">
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
        </div>
        <div className="RegisterForm-column">
          <div className="RegisterForm-item">
            <Controller
              name="realName"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  {...field}
                  value={field.value ?? ''}
                  label={t('Common.label.realName')}
                  error={fieldState.error?.message}
                  touched={fieldState.isTouched}
                />
              )}
            />
          </div>
          <div className="RegisterForm-item">
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  {...field}
                  value={field.value ?? ''}
                  label={t('Common.label.email')}
                  type="email"
                  error={fieldState.error?.message}
                  touched={fieldState.isTouched}
                />
              )}
            />
          </div>
          <div className="RegisterForm-item">
            <Controller
              name="emailConfirm"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  {...field}
                  value={field.value ?? ''}
                  label={t('Common.label.confirmEmail')}
                  type="email"
                  error={fieldState.error?.message}
                  touched={fieldState.isTouched}
                />
              )}
            />
          </div>
          <div className="RegisterForm-item">
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <CountryDropdown
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            />
          </div>
          <Button className="RegisterForm-submit tall" color="primary" variant="contained" type="submit">
            {t('RegisterForm.label.register')}
          </Button>
        </div>
      </form>

      {error && (
        <div className="RegisterForm-item">
          <Typography color="error">{error}</Typography>
        </div>
      )}
    </>
  );
};

export default RegisterForm;
