import { useMemo } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { CheckboxField } from '@app/components';
import { DialogShell } from '@app/dialogs';

import {
  BAN_MAX_DAYS,
  BAN_MAX_HOURS,
  BAN_MAX_MINUTES,
  buildBanUserSchema,
  type BanUserFormValues,
} from './moderationFormSchemas';
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  ERROR_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
} from './moderationStyles';

export interface BanUserDialogProps {
  userInfo: ServerInfo_User;
  onSubmit: (values: BanUserFormValues) => void;
  onCancel: () => void;
}

type TextField = 'userName' | 'address' | 'clientId';
type ToggleField = 'byName' | 'byIp' | 'byClientId';

const BanTypeRow = ({ control, toggle, text, label }: {
  control: Control<BanUserFormValues>;
  toggle: ToggleField;
  text: TextField;
  label: string;
}) => (
  <div className="grid grid-cols-[minmax(9rem,auto),1fr] items-start gap-3">
    <Controller
      name={toggle}
      control={control}
      render={({ field }) => (
        <CheckboxField
          name={field.name}
          value={field.value}
          onChange={(e) => field.onChange(e.target.checked)}
          onBlur={field.onBlur}
          label={label}
        />
      )}
    />
    <Controller
      name={text}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          <input {...field} aria-label={label} className={FIELD_CLASS} maxLength={255} />
          {fieldState.error && <span role="alert" className={ERROR_CLASS}>{fieldState.error.message}</span>}
        </div>
      )}
    />
  </div>
);

const DurationInput = ({ control, name, label, max, disabled }: {
  control: Control<BanUserFormValues>;
  name: 'days' | 'hours' | 'minutes';
  label: string;
  max: number;
  disabled: boolean;
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <label className="flex-1">
        <span className={LABEL_CLASS}>{label}</span>
        <input
          type="number"
          min={0}
          max={max}
          step={1}
          name={field.name}
          value={field.value}
          onBlur={field.onBlur}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            field.onChange(Number.isNaN(parsed) ? 0 : Math.min(max, Math.max(0, parsed)));
          }}
          disabled={disabled}
          className={FIELD_CLASS}
        />
      </label>
    )}
  />
);

const BanUserDialog = ({ userInfo, onSubmit, onCancel }: BanUserDialogProps) => {
  const { t } = useTranslation();
  const resolver = useMemo(() => zodResolver(buildBanUserSchema(t)), [t]);
  const { control, handleSubmit, formState } = useForm<BanUserFormValues>({
    defaultValues: {
      byName: true,
      userName: userInfo.name,
      byIp: true,
      address: userInfo.address,
      byClientId: userInfo.clientid !== '',
      clientId: userInfo.clientid,
      duration: 'temporary',
      days: 0,
      hours: 0,
      minutes: 5,
      reason: '',
      visibleReason: '',
      redact: false,
    },
    resolver,
  });
  const duration = useWatch({ control, name: 'duration' });
  const temporaryDisabled = duration !== 'temporary';
  const banTypeError = formState.errors.byName?.message;

  return (
    <DialogShell isOpen handleClose={onCancel} title={t('Moderation.ban.title')} maxWidth="max-w-lg">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <fieldset className="flex flex-col gap-2">
          <legend className={LABEL_CLASS}>{t('Moderation.ban.banType')}</legend>
          <BanTypeRow control={control} toggle="byName" text="userName" label={t('Moderation.ban.byName')} />
          <BanTypeRow control={control} toggle="byIp" text="address" label={t('Moderation.ban.byIp')} />
          <BanTypeRow control={control} toggle="byClientId" text="clientId" label={t('Moderation.ban.byClientId')} />
          {banTypeError && <span role="alert" className={ERROR_CLASS}>{banTypeError}</span>}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={LABEL_CLASS}>{t('Moderation.ban.duration')}</legend>
          <Controller
            name="duration"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1 text-sm text-text-secondary">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={field.name}
                    checked={field.value === 'permanent'}
                    onChange={() => field.onChange('permanent')}
                    className="accent-accent"
                  />
                  {t('Moderation.ban.permanent')}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={field.name}
                    checked={field.value === 'temporary'}
                    onChange={() => field.onChange('temporary')}
                    className="accent-accent"
                  />
                  {t('Moderation.ban.temporary')}
                </label>
              </div>
            )}
          />
          <div className="flex gap-3">
            <DurationInput
              control={control}
              name="days"
              label={t('Moderation.ban.days')}
              max={BAN_MAX_DAYS}
              disabled={temporaryDisabled}
            />
            <DurationInput
              control={control}
              name="hours"
              label={t('Moderation.ban.hours')}
              max={BAN_MAX_HOURS}
              disabled={temporaryDisabled}
            />
            <DurationInput
              control={control}
              name="minutes"
              label={t('Moderation.ban.minutes')}
              max={BAN_MAX_MINUTES}
              disabled={temporaryDisabled}
            />
          </div>
        </fieldset>

        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <label>
              <span className={LABEL_CLASS}>{t('Moderation.ban.reason')}</span>
              <textarea {...field} rows={3} className={FIELD_CLASS + ' resize-y'} />
            </label>
          )}
        />
        <Controller
          name="visibleReason"
          control={control}
          render={({ field }) => (
            <label>
              <span className={LABEL_CLASS}>{t('Moderation.ban.visibleReason')}</span>
              <textarea {...field} rows={3} className={FIELD_CLASS + ' resize-y'} />
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
              label={t('Moderation.ban.redact')}
            />
          )}
        />
        <div className="flex justify-end gap-2">
          <button type="submit" className={BUTTON_PRIMARY_CLASS}>{t('Moderation.common.ok')}</button>
          <button type="button" className={BUTTON_SECONDARY_CLASS} onClick={onCancel}>{t('Moderation.common.cancel')}</button>
        </div>
      </form>
    </DialogShell>
  );
};

export default BanUserDialog;
