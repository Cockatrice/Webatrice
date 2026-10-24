import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { CheckboxField } from '@app/components';
import { DialogShell } from '@app/dialogs';

import { buildWarnUserSchema, type WarnUserFormValues } from './moderationFormSchemas';
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  ERROR_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
} from './moderationStyles';

export interface WarningOption {
  warning: string;
  startingIl: number;
}

export interface WarnUserDialogProps {
  userName: string;
  warnings: WarningOption[];
  onSubmit: (values: WarnUserFormValues) => void;
  onCancel: () => void;
}

const WarnUserDialog = ({ userName, warnings, onSubmit, onCancel }: WarnUserDialogProps) => {
  const { t } = useTranslation();
  const resolver = useMemo(() => zodResolver(buildWarnUserSchema(t)), [t]);
  const { control, handleSubmit } = useForm<WarnUserFormValues>({
    defaultValues: { userName, reason: '', redact: false },
    resolver,
  });

  return (
    <DialogShell isOpen handleClose={onCancel} title={t('Moderation.warn.title')}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <p className="text-sm text-text-secondary">{t('Moderation.warn.description')}</p>
        <Controller
          name="userName"
          control={control}
          render={({ field, fieldState }) => (
            <label>
              <span className={LABEL_CLASS}>{t('Moderation.warn.userName')}</span>
              <input {...field} className={FIELD_CLASS} maxLength={255} />
              {fieldState.error && <span role="alert" className={ERROR_CLASS}>{fieldState.error.message}</span>}
            </label>
          )}
        />
        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <label>
              <span className={LABEL_CLASS}>{t('Moderation.warn.reason')}</span>
              <select {...field} className={FIELD_CLASS} autoFocus>
                <option value="" />
                {warnings.map(({ warning, startingIl }) => (
                  <option key={warning} value={warning}>
                    {startingIl > 1 ? t('Moderation.warn.withLevel', { warning, level: startingIl }) : warning}
                  </option>
                ))}
              </select>
              {fieldState.error && <span role="alert" className={ERROR_CLASS}>{fieldState.error.message}</span>}
            </label>
          )}
        />
        <Controller
          name="redact"
          control={control}
          render={({ field }) => (
            <CheckboxField
              name={field.name}
              value={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              label={t('Moderation.warn.redact')}
            />
          )}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button type="submit" className={BUTTON_PRIMARY_CLASS}>{t('Moderation.common.ok')}</button>
          <button type="button" className={BUTTON_SECONDARY_CLASS} onClick={onCancel}>{t('Moderation.common.cancel')}</button>
        </div>
      </form>
    </DialogShell>
  );
};

export default WarnUserDialog;
