import { useMemo, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { TFunction } from 'i18next';

import { type games } from '@cockatrice/datatrice';
import { Button, PlaymatImage, TextInput } from '@app/components';
import { cx } from '@app/utils';

import { FieldError } from '../controls/fields';

interface ArtPreviewProps {
  playmat?: games.Playmat;
  width: number;
  height: number;
  empty?: ReactNode;
  children?: ReactNode;
}

export function ArtPreview({ playmat, width, height, empty, children }: ArtPreviewProps) {
  if (!playmat) {
    return (
      <span
        style={{ width, height }}
        className={cx(
          'flex items-center justify-center rounded-ui border border-dashed border-border-strong',
          'bg-bg-sunken text-[11px] text-text-muted',
        )}
      >
        {empty}
      </span>
    );
  }
  return (
    <span style={{ width, height }} className="relative block overflow-hidden rounded-ui bg-bg-sunken">
      <PlaymatImage playmat={playmat} area={{ width, height }} />
      {children}
    </span>
  );
}

const buildSchema = (t: TFunction, maxLength?: number) => {
  const name = z.string().trim().min(1, t('Common.validation.required'));
  return z.object({
    cardName: maxLength
      ? name.max(maxLength, t('PlaymatSettings.validation.tooLong', { max: maxLength }))
      : name,
  });
};

type FormValues = { cardName: string };

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

interface CardNameFormProps {
  label: string;
  submitLabel: string;
  submitAriaLabel?: string;
  maxLength?: number;
  disabled?: boolean;
  cancelDisabled?: boolean;
  onSubmit: (cardName: string) => Promise<SubmitResult> | SubmitResult;
  onCancel: () => void;
  className?: string;
}

export function CardNameForm({
  label,
  submitLabel,
  submitAriaLabel,
  maxLength,
  disabled,
  cancelDisabled,
  onSubmit,
  onCancel,
  className,
}: CardNameFormProps) {
  const { t } = useTranslation();
  const resolver = useMemo(() => zodResolver(buildSchema(t, maxLength)), [t, maxLength]);
  const { control, handleSubmit, setError, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { cardName: '' },
    resolver,
  });

  const submit = handleSubmit(async ({ cardName }) => {
    const result = await onSubmit(cardName.trim());
    if (result.ok) {
      reset();
    } else if (result.error) {
      setError('cardName', { message: result.error });
    }
  });

  return (
    <form className={cx('flex flex-wrap items-start gap-2', className)} onSubmit={submit} noValidate>
      <Controller
        name="cardName"
        control={control}
        render={({ field, fieldState }) => (
          <span className="flex min-w-[16rem] flex-col gap-1">
            <TextInput
              {...field}
              icon={null}
              label={label}
              maxLength={maxLength}
              autoFocus
              disabled={disabled || isSubmitting}
              placeholder={t('PlaymatSettings.collection.cardNamePlaceholder')}
              aria-invalid={fieldState.error ? true : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !cancelDisabled) {
                  e.preventDefault();
                  onCancel();
                }
              }}
            />
            {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
          </span>
        )}
      />
      <span className="mt-[22px] flex gap-2">
        <Button type="submit" variant="primary" aria-label={submitAriaLabel} disabled={disabled || isSubmitting}>
          {submitLabel}
        </Button>
        <Button variant="quiet" disabled={cancelDisabled} onClick={onCancel}>{t('PlaymatSettings.collection.cancel')}</Button>
      </span>
    </form>
  );
}
