import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { InputField } from '@app/components';
import { useReduxEffect } from '@app/hooks';
import { server } from '@cockatrice/datatrice';

import {
  buildAccountActivationFormSchema,
  type AccountActivationFormValues,
} from './accountActivationFormSchema';
import './AccountActivationForm.css';

export type { AccountActivationFormValues };

interface AccountActivationFormProps {
  onSubmit: (values: AccountActivationFormValues) => void;
}

const AccountActivationForm = ({ onSubmit }: AccountActivationFormProps) => {
  const [errorMessage, setErrorMessage] = useState(false);
  const { t } = useTranslation();

  useReduxEffect(() => {
    setErrorMessage(true);
  }, server.Types.ACCOUNT_ACTIVATION_FAILED, []);

  const { control, handleSubmit } = useForm<AccountActivationFormValues>({
    defaultValues: { token: '' },
    resolver: zodResolver(buildAccountActivationFormSchema(t)),
  });

  const submit = handleSubmit((values) => {
    setErrorMessage(false);
    onSubmit(values);
  });

  return (
    <form className="AccountActivationForm" onSubmit={submit}>
      <div className="AccountActivationForm-item">
        <Controller
          name="token"
          control={control}
          render={({ field, fieldState }) => (
            <InputField
              {...field}
              label={t('Common.label.token')}
              error={fieldState.error?.message}
              touched={fieldState.isTouched}
            />
          )}
        />
      </div>

      {errorMessage && (
        <div className="AccountActivationForm-error">
          <Typography color="error">{t('AccountActivationForm.error.failed')}</Typography>
        </div>
      )}

      <Button className="AccountActivationForm-submit rounded tall" color="primary" variant="contained" type="submit">
        {t('AccountActivationForm.label.activate')}
      </Button>
    </form>
  );
};

export default AccountActivationForm;
