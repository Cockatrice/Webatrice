import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Button, IconButton, Kbd } from '@app/components';
import { useMessageMacros, useSettings } from '@app/hooks';
import { cx } from '@app/utils';

import type { CustomControlProps } from '../registry';
import { buildMessageMacroSchema, type MessageMacroValues } from './chatSettingsSchemas';
import { FieldError, textField } from './fields';

export default function MessageMacrosEditor({ labelId, describedBy, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const macros = useMessageMacros();
  const [editing, setEditing] = useState<number | null>(null);

  const save = (next: string[]) => {
    void settings.update({ messageMacros: next });
  };

  return (
    <div className="flex flex-col gap-3" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
      {macros.length === 0 ? (
        <p className="text-[12px] text-text-muted">{t('SettingsChat.macros.empty')}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border-subtle rounded-ui border border-border-subtle">
          {macros.map((macro, index) => (
            <li key={`${index}:${macro}`} className="flex min-h-row items-center gap-2 px-2.5 py-1 text-[13px]">
              {editing === index ? (
                <MacroForm
                  initial={macro}
                  submitLabel={t('SettingsChat.macros.save')}
                  inputLabel={t('SettingsChat.macros.editLabel', { index: index + 1 })}
                  disabled={disabled}
                  onCancel={() => setEditing(null)}
                  onSubmit={(message) => {
                    save(macros.map((m, i) => (i === index ? message : m)));
                    setEditing(null);
                  }}
                />
              ) : (
                <>
                  <Kbd>{index + 1}</Kbd>
                  <span className="min-w-0 flex-1 break-words text-text-primary">{macro}</span>
                  <IconButton
                    size="sm"
                    label={t('SettingsChat.macros.edit', { message: macro })}
                    disabled={disabled}
                    onClick={() => setEditing(index)}
                  >
                    <Pencil size={14} aria-hidden />
                  </IconButton>
                  <IconButton
                    size="sm"
                    className="hover:!text-danger"
                    label={t('SettingsChat.macros.remove', { message: macro })}
                    disabled={disabled}
                    onClick={() => {
                      setEditing(null);
                      save(macros.filter((_, i) => i !== index));
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      <MacroForm
        submitLabel={t('SettingsChat.macros.add')}
        inputLabel={t('SettingsChat.macros.newLabel')}
        disabled={disabled}
        resetOnSubmit
        onSubmit={(message) => save([...macros, message])}
      />
    </div>
  );
}

interface MacroFormProps {
  initial?: string;
  submitLabel: string;
  inputLabel: string;
  disabled: boolean;
  resetOnSubmit?: boolean;
  onSubmit: (message: string) => void;
  onCancel?: () => void;
}

function MacroForm({ initial = '', submitLabel, inputLabel, disabled, resetOnSubmit, onSubmit, onCancel }: MacroFormProps) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildMessageMacroSchema(t), [t]);
  const { control, handleSubmit, reset } = useForm<MessageMacroValues>({
    defaultValues: { message: initial },
    resolver: zodResolver(schema),
  });

  const submit = handleSubmit(({ message }) => {
    onSubmit(message);
    if (resetOnSubmit) {
      reset({ message: '' });
    }
  });

  return (
    <form className="flex flex-1 flex-wrap items-start gap-2" onSubmit={submit} noValidate>
      <Controller
        name="message"
        control={control}
        render={({ field, fieldState }) => (
          <span className="flex min-w-[16rem] flex-1 flex-col gap-1">
            <input
              {...field}
              type="text"
              className={cx(textField, 'w-full')}
              aria-label={inputLabel}
              aria-invalid={fieldState.error ? true : undefined}
              placeholder={t('SettingsChat.macros.placeholder')}
              disabled={disabled}
              autoFocus={initial !== ''}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && onCancel) {
                  e.preventDefault();
                  onCancel();
                }
              }}
            />
            {fieldState.error && (
              <FieldError>{fieldState.error.message}</FieldError>
            )}
          </span>
        )}
      />
      <Button
        type="submit"
        variant={onCancel ? 'primary' : 'secondary'}
        disabled={disabled}
        icon={onCancel ? undefined : <Plus size={14} aria-hidden />}
      >
        {submitLabel}
      </Button>
      {onCancel && (
        <Button variant="quiet" onClick={onCancel}>
          {t('SettingsChat.macros.cancel')}
        </Button>
      )}
    </form>
  );
}
