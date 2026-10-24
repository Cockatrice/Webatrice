import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { z } from 'zod';

import Button from '@mui/material/Button';

import { InputField } from '@app/components';
import { useGridRows } from '@app/hooks';
import { isValidPictureUrlTemplate, PICTURE_URL_PLACEHOLDERS } from '@app/services';

import { usePictureUrlTemplates } from './usePictureUrlTemplates';

import './CardDatabase.css';

const buildTemplateSchema = (t: TFunction) => z.object({
  url: z.string().trim().refine(isValidPictureUrlTemplate, t('CardSourcesSettings.validation.url')),
});

type TemplateValues = z.infer<ReturnType<typeof buildTemplateSchema>>;

export interface CardSourcesSettingsProps {
  labelId?: string;
  describedBy?: string;
}

const CardSourcesSettings = ({ labelId, describedBy }: CardSourcesSettingsProps) => {
  const { t } = useTranslation();
  const sources = usePictureUrlTemplates();
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useMemo(() => zodResolver(buildTemplateSchema(t)), [t]);
  const { control, handleSubmit, reset, formState: { isSubmitted } } = useForm<TemplateValues>({
    defaultValues: { url: '' },
    resolver,
  });

  const selected = sources.selectedIndex;
  const add = handleSubmit(async ({ url }) => {
    await sources.add(url);
    reset({ url: '' });
  });
  const edit = handleSubmit(async ({ url }) => {
    await sources.replaceSelected(url);
    reset({ url: '' });
  });

  const select = (index: number) => {
    sources.select(index);
    reset({ url: sources.templates[index] });
    setMessage(null);
  };

  const { getRowProps } = useGridRows({
    keys: sources.templates.map((_, index) => String(index)),
    selectedKey: selected === null ? null : String(selected),
    onSelect: (key) => select(Number(key)),
    onActivate: (key) => select(Number(key)),
  });

  const resetAll = async () => {
    await sources.resetToDefaults();
    reset({ url: '' });
    setMessage(t('CardSourcesSettings.message.reset'));
  };

  return (
    <div className="cardDatabase-sources" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>

      <ol className="cardDatabase-templateList" role="listbox" aria-label={t('CardSourcesSettings.label.list')}>
        {sources.templates.map((template, index) => (
          <li
            key={`${index}:${template}`}
            {...getRowProps(String(index))}
            role="option"
            aria-selected={selected === index}
            className={selected === index ? 'is-selected' : ''}
            onClick={() => select(index)}
          >
            <code>{template}</code>
          </li>
        ))}
      </ol>

      <div className="cardDatabase-actions">
        <Button disabled={selected === null || selected === 0} onClick={() => sources.moveSelected(-1)}>
          {t('CardSourcesSettings.button.up')}
        </Button>
        <Button
          disabled={selected === null || selected === sources.templates.length - 1}
          onClick={() => sources.moveSelected(1)}
        >
          {t('CardSourcesSettings.button.down')}
        </Button>
        <Button disabled={selected === null} color="error" onClick={sources.removeSelected}>
          {t('CardSourcesSettings.button.remove')}
        </Button>
        <Button onClick={resetAll}>{t('CardSourcesSettings.button.reset')}</Button>
      </div>

      <form className="cardDatabase-templateForm" onSubmit={add}>
        <Controller
          name="url"
          control={control}
          render={({ field, fieldState }) => (
            <InputField
              {...field}
              label={t('CardSourcesSettings.label.url')}
              error={fieldState.error?.message}
              touched={fieldState.isTouched || isSubmitted}
            />
          )}
        />
        <div className="cardDatabase-actions">
          <Button type="submit">{t('CardSourcesSettings.button.add')}</Button>
          <Button disabled={selected === null} onClick={edit}>{t('CardSourcesSettings.button.edit')}</Button>
        </div>
      </form>

      <details className="cardDatabase-hints">
        <summary>{t('CardSourcesSettings.label.placeholders')}</summary>
        <p><code>{PICTURE_URL_PLACEHOLDERS.join(' ')}</code></p>
      </details>

      {message && <div role="status">{message}</div>}
      {sources.error && (
        <div className="cardDatabase-error" role="alert">
          {t(`CardSourcesSettings.error.${sources.error.key}`, { error: sources.error.detail })}
        </div>
      )}
    </div>
  );
};

export default CardSourcesSettings;
