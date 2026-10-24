import { useEffect, useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';
import { DialogShell } from '@app/dialogs';
import { fieldClass, labelClass } from '@app/feature-wrappers/staff';

import {
  buildShutdownSchema,
  DEFAULT_SHUTDOWN_MINUTES,
  MAX_SHUTDOWN_MINUTES,
  MAX_SHUTDOWN_REASON_LENGTH,
  type ShutdownFormValues,
} from './administrationSchemas';

interface ShutdownDialogProps {
  isOpen: boolean;
  onSubmit: (reason: string, minutes: number) => void;
  onCancel: () => void;
}

const DEFAULT_VALUES: ShutdownFormValues = { reason: '', minutes: String(DEFAULT_SHUTDOWN_MINUTES) };

const ShutdownDialog = ({ isOpen, onSubmit, onCancel }: ShutdownDialogProps) => {
  const { t } = useTranslation();
  const formId = useId();
  const reasonId = useId();
  const minutesId = useId();
  const resolver = useMemo(() => zodResolver(buildShutdownSchema(t)), [t]);
  const { control, handleSubmit, reset } = useForm<ShutdownFormValues>({ defaultValues: DEFAULT_VALUES, resolver });

  useEffect(() => {
    if (isOpen) {
      reset(DEFAULT_VALUES);
    }
  }, [isOpen, reset]);

  const submit = handleSubmit(({ reason, minutes }) => onSubmit(reason, Number(minutes)));

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={onCancel}
      title={t('Administration.shutdown.title')}
      footer={(
        <>
          <Button variant="quiet" onClick={onCancel}>{t('Administration.button.cancel')}</Button>
          <Button type="submit" form={formId} variant="danger">{t('Administration.shutdown.confirm')}</Button>
        </>
      )}
    >
      <form id={formId} className="flex flex-col gap-3" onSubmit={submit} noValidate>
        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1">
              <label htmlFor={reasonId} className={labelClass}>{t('Administration.shutdown.reason')}</label>
              <input {...field} id={reasonId} autoFocus className={fieldClass} maxLength={MAX_SHUTDOWN_REASON_LENGTH} />
              {fieldState.error && <span role="alert" className="text-[12px] text-danger">{fieldState.error.message}</span>}
            </div>
          )}
        />
        <Controller
          name="minutes"
          control={control}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1">
              <label htmlFor={minutesId} className={labelClass}>{t('Administration.shutdown.minutes')}</label>
              <input
                {...field}
                id={minutesId}
                type="number"
                className={fieldClass}
                min={0}
                max={MAX_SHUTDOWN_MINUTES}
                step={1}
              />
              {fieldState.error && <span role="alert" className="text-[12px] text-danger">{fieldState.error.message}</span>}
            </div>
          )}
        />
      </form>
    </DialogShell>
  );
};

export default ShutdownDialog;
