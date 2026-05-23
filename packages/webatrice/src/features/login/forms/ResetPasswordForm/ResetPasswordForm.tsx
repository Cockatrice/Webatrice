import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { InputField } from '@app/components';
import { KnownHosts } from '@app/feature-widgets/known-hosts';
import type { HostDTO } from '@app/services';
import { useResetPasswordForm } from './useResetPasswordForm';

import {
  buildResetPasswordFormSchema,
  type ResetPasswordFormValues,
} from './resetPasswordFormSchema';
import './ResetPasswordForm.css';

export type { ResetPasswordFormValues };

interface ResetPasswordFormProps {
  onSubmit: (values: ResetPasswordFormValues) => void;
  userName?: string;
}

const ResetPasswordForm = ({ onSubmit, userName }: ResetPasswordFormProps) => {
  const { t } = useTranslation();
  const { errorMessage } = useResetPasswordForm();

  const { control, handleSubmit } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      userName: userName ?? '',
      token: '',
      newPassword: '',
      passwordAgain: '',
      selectedHost: undefined as unknown as HostDTO,
    },
    resolver: zodResolver(buildResetPasswordFormSchema(t)),
  });

  const submit = handleSubmit(onSubmit);

  return (
    <form className='ResetPasswordForm' onSubmit={submit}>
      <div className='ResetPasswordForm-items'>
        <div className='ResetPasswordForm-item'>
          <Controller
            name='userName'
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label={t('Common.label.username')}
                autoComplete='username'
                slotProps={{ input: { readOnly: Boolean(userName) } }}
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </div>
        <div className='ResetPasswordForm-item'>
          <Controller
            name='token'
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
        <div className='ResetPasswordForm-item'>
          <Controller
            name='newPassword'
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label={t('Common.label.password')}
                type='password'
                autoComplete='new-password'
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </div>
        <div className='ResetPasswordForm-item'>
          <Controller
            name='passwordAgain'
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label={t('Common.label.passwordAgain')}
                type='password'
                autoComplete='new-password'
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </div>
        <div className='ResetPasswordForm-item'>
          <Controller
            name='selectedHost'
            control={control}
            render={({ field, fieldState }) => (
              <KnownHosts
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
                disabled
              />
            )}
          />
        </div>

        {errorMessage && (
          <div className='ResetPasswordForm-item'>
            <Typography color="error">{t('ResetPasswordForm.error')}</Typography>
          </div>
        )}
      </div>
      <Button className='ResetPasswordForm-submit rounded tall' color='primary' variant='contained' type='submit'>
        {t('ResetPasswordForm.label.reset')}
      </Button>
    </form>
  );
};

export default ResetPasswordForm;
