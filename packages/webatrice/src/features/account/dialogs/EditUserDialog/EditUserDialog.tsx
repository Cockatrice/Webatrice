import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { CountryDropdown, InputField } from '@app/components';
import { AlertDialog, DialogShell } from '@app/dialogs';

import { buildEditUserFormSchema, needsPasswordCheck, type EditUserFormValues } from './editUserFormSchema';
import { useEditUser, type EditUser, type EditUserProfile } from './useEditUser';

interface EditUserDialogProps {
  isOpen: boolean;
  handleClose: () => void;
}

const EditUserForm = ({ profile, supportsPasswordHash, pending, error, submit, handleClose }:
  EditUser & { profile: EditUserProfile; handleClose: () => void }) => {
  const { t } = useTranslation();
  const originalEmail = profile.email;

  const resolver = useMemo(
    () => zodResolver(buildEditUserFormSchema(t, { originalEmail, supportsPasswordHash })),
    [t, originalEmail, supportsPasswordHash],
  );

  const values = useMemo(
    () => ({ ...profile, passwordCheck: '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- profile is rebuilt every render; key on its fields
    [profile.email, profile.country, profile.realName],
  );

  const { control, handleSubmit, watch, formState: { isSubmitted } } = useForm<EditUserFormValues>({
    defaultValues: values,
    resolver,
  });

  const showPasswordCheck = needsPasswordCheck(watch('email'), { originalEmail, supportsPasswordHash });

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit(submit)}>
      <Controller
        name="email"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            {...field}
            label={t('Common.label.email')}
            type="email"
            autoComplete="email"
            error={fieldState.error?.message}
            touched={fieldState.isTouched || isSubmitted}
          />
        )}
      />
      {showPasswordCheck && (
        <Controller
          name="passwordCheck"
          control={control}
          render={({ field, fieldState }) => (
            <InputField
              {...field}
              label={t('EditUserDialog.label.passwordCheck')}
              type="password"
              autoComplete="current-password"
              error={fieldState.error?.message}
              touched={fieldState.isTouched || isSubmitted}
            />
          )}
        />
      )}
      <Controller
        name="country"
        control={control}
        render={({ field }) => (
          <CountryDropdown value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
        )}
      />
      <Controller
        name="realName"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            {...field}
            label={t('Common.label.realName')}
            autoComplete="name"
            error={fieldState.error?.message}
            touched={fieldState.isTouched || isSubmitted}
          />
        )}
      />
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

const EditUserContent = ({ handleClose }: { handleClose: () => void }) => {
  const { t } = useTranslation();
  const edit = useEditUser(handleClose);

  if (!edit.profile) {
    return edit.error ? (
      <AlertDialog isOpen title={t('EditUserDialog.title')} message={edit.error} onDismiss={handleClose} />
    ) : null;
  }

  return (
    <DialogShell isOpen handleClose={handleClose} title={t('EditUserDialog.title')}>
      <EditUserForm {...edit} profile={edit.profile} handleClose={handleClose} />
    </DialogShell>
  );
};

const EditUserDialog = ({ isOpen, handleClose }: EditUserDialogProps) =>
  isOpen ? <EditUserContent handleClose={handleClose} /> : null;

export default EditUserDialog;
