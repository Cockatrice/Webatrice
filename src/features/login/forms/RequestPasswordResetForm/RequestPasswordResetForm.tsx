import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { InputField } from '@app/components';
import { KnownHosts } from '@app/feature-widgets/known-hosts';
import type { HostDTO } from '@app/services';
import { useRequestPasswordResetForm } from './useRequestPasswordResetForm';

import {
  buildRequestPasswordResetFormSchema,
  type RequestPasswordResetFormValues,
} from './requestPasswordResetFormSchema';
import './RequestPasswordResetForm.css';

export type { RequestPasswordResetFormValues };

interface RequestPasswordResetFormProps {
  onSubmit: (values: RequestPasswordResetFormValues) => void;
  skipTokenRequest: (userName: string) => void;
}

const RequestPasswordResetForm = ({ onSubmit, skipTokenRequest }: RequestPasswordResetFormProps) => {
  const { t } = useTranslation();
  const { errorMessage, setErrorMessage, isMFA, setIsMFA } = useRequestPasswordResetForm();

  const schema = useMemo(() => buildRequestPasswordResetFormSchema(t, isMFA), [t, isMFA]);

  const { control, handleSubmit, setValue, watch, getValues } = useForm<RequestPasswordResetFormValues>({
    defaultValues: {
      userName: '',
      email: '',
      selectedHost: undefined as unknown as HostDTO,
    },
    resolver: zodResolver(schema),
  });

  const selectedHost = watch('selectedHost');

  useEffect(() => {
    if (!selectedHost) {
      return;
    }
    setValue('userName', selectedHost.userName ?? '');
    setIsMFA(false);
  }, [selectedHost, setValue, setIsMFA]);

  const submit = handleSubmit((values) => {
    setErrorMessage(false);
    onSubmit(values);
  });

  return (
    <form className="RequestPasswordResetForm" onSubmit={submit}>
      <div className="RequestPasswordResetForm-items">
        <div className="RequestPasswordResetForm-item">
          <Controller
            name="userName"
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label={t('Common.label.username')}
                autoComplete="username"
                disabled={isMFA}
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </div>
        {isMFA ? (
          <div className="RequestPasswordResetForm-item">
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  {...field}
                  value={field.value ?? ''}
                  label={t('Common.label.email')}
                  type="email"
                  autoComplete="email"
                  error={fieldState.error?.message}
                  touched={fieldState.isTouched}
                />
              )}
            />
            <div>{t('RequestPasswordResetForm.mfaEnabled')}</div>
          </div>
        ) : null}
        <div className="RequestPasswordResetForm-item selectedHost">
          <Controller
            name="selectedHost"
            control={control}
            render={({ field, fieldState }) => (
              <KnownHosts
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
                disabled={isMFA}
              />
            )}
          />
        </div>

        {errorMessage && (
          <div className="RequestPasswordResetForm-item">
            <Typography color="error">{t('RequestPasswordResetForm.error')}</Typography>
          </div>
        )}
      </div>

      <Button
        className="RequestPasswordResetForm-submit rounded tall"
        color="primary"
        variant="contained"
        type="submit"
      >
        {t('RequestPasswordResetForm.request')}
      </Button>

      <div>
        <Button color="primary" onClick={() => skipTokenRequest(getValues('userName'))}>
          {t('RequestPasswordResetForm.skipRequest')}
        </Button>
      </div>
    </form>
  );
};

export default RequestPasswordResetForm;
