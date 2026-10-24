import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { InputField } from '@app/components';
import { DialogShell } from '@app/dialogs';

import { buildChangePasswordFormSchema, type ChangePasswordFormValues } from './changePasswordFormSchema';
import { useChangePassword } from './useChangePassword';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  handleClose: () => void;
}

const FIELDS = [
  { name: 'oldPassword', label: 'ChangePasswordDialog.label.oldPassword', autoComplete: 'current-password' },
  { name: 'newPassword', label: 'ChangePasswordDialog.label.newPassword', autoComplete: 'new-password' },
  { name: 'newPasswordConfirm', label: 'ChangePasswordDialog.label.newPasswordConfirm', autoComplete: 'new-password' },
] as const;

const ChangePasswordForm = ({ handleClose }: { handleClose: () => void }) => {
  const { t } = useTranslation();
  const { pending, error, submit } = useChangePassword(handleClose);
  const resolver = useMemo(() => zodResolver(buildChangePasswordFormSchema(t)), [t]);

  const { control, handleSubmit, formState: { isSubmitted } } = useForm<ChangePasswordFormValues>({
    defaultValues: { oldPassword: '', newPassword: '', newPasswordConfirm: '' },
    resolver,
  });

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit(submit)}>
      {FIELDS.map(({ name, label, autoComplete }) => (
        <Controller
          key={name}
          name={name}
          control={control}
          render={({ field, fieldState }) => (
            <InputField
              {...field}
              label={t(label)}
              type="password"
              autoComplete={autoComplete}
              error={fieldState.error?.message}
              touched={fieldState.isTouched || isSubmitted}
            />
          )}
        />
      ))}
      {error && <Typography color="error" role="alert">{error}</Typography>}
      <div className="flex justify-end gap-2">
        <Button onClick={handleClose}>{t('AccountDialogs.label.cancel')}</Button>
        <Button type="submit" variant="contained" color="primary" disabled={pending}>
          {t('AccountDialogs.label.ok')}
        </Button>
      </div>
    </form>
  );
};

const ChangePasswordDialog = ({ isOpen, handleClose }: ChangePasswordDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogShell isOpen={isOpen} handleClose={handleClose} title={t('ChangePasswordDialog.title')}>
      <ChangePasswordForm handleClose={handleClose} />
    </DialogShell>
  );
};

export default ChangePasswordDialog;
