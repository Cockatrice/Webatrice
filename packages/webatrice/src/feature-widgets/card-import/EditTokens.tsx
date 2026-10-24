import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import Button from '@mui/material/Button';

import { InputField, SelectField } from '@app/components';
import { useGridRows } from '@app/hooks';
import type { Token } from '@app/services';

import {
  buildAddTokenSchema,
  buildTokenDataSchema,
  readTokenData,
  TOKEN_COLORS,
  type AddTokenValues,
  type TokenData,
} from './customTokens';
import { useEditTokens } from './useEditTokens';

import './CardDatabase.css';

function saveTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/xml' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface TokenDataFormProps {
  token: Token;
  onSubmit: (data: TokenData) => Promise<void>;
  onRemove: () => Promise<void>;
}

const TokenDataForm = ({ token, onSubmit, onRemove }: TokenDataFormProps) => {
  const { t } = useTranslation();
  const resolver = useMemo(() => zodResolver(buildTokenDataSchema(t)), [t]);
  const { control, handleSubmit, reset, formState } = useForm<TokenData>({
    defaultValues: readTokenData(token),
    resolver,
  });

  useEffect(() => {
    reset(readTokenData(token));
  }, [token, reset]);

  const colorOptions = TOKEN_COLORS.map((color) => ({
    value: color,
    label: t(`EditTokens.color.${color}`),
  }));

  return (
    <form className="cardDatabase-tokenForm" onSubmit={handleSubmit(onSubmit)} aria-label={t('EditTokens.data')}>
      <InputField label={t('EditTokens.label.name')} value={token.name.value} onChange={() => {}} disabled />
      <Controller
        name="color"
        control={control}
        render={({ field }) => (
          <SelectField
            label={t('EditTokens.label.color')}
            options={colorOptions}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        name="pt"
        control={control}
        render={({ field, fieldState }) => (
          <InputField {...field} label={t('EditTokens.label.pt')} error={fieldState.error?.message} touched={fieldState.isTouched} />
        )}
      />
      <Controller
        name="annotation"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            {...field}
            label={t('EditTokens.label.annotation')}
            error={fieldState.error?.message}
            touched={fieldState.isTouched}
          />
        )}
      />
      <div className="cardDatabase-actions">
        <Button color="error" onClick={onRemove}>{t('EditTokens.button.remove')}</Button>
        <Button type="submit" variant="contained" disabled={!formState.isDirty || formState.isSubmitting}>
          {t('EditTokens.button.apply')}
        </Button>
      </div>
    </form>
  );
};

const EditTokens = () => {
  const { t } = useTranslation();
  const editor = useEditTokens();
  const resolver = useMemo(() => zodResolver(buildAddTokenSchema(t)), [t]);
  const { control, handleSubmit, reset, setError, formState: { isSubmitted, isSubmitting } } = useForm<AddTokenValues>({
    defaultValues: { name: '' },
    resolver,
  });

  const { getRowProps } = useGridRows({
    keys: editor.tokens.map((token) => token.name.value),
    selectedKey: editor.selected?.name.value ?? null,
    onSelect: editor.select,
    onActivate: editor.select,
  });

  const add = handleSubmit(async ({ name }) => {
    if (await editor.addToken(name) === 'conflict') {
      setError('name', { type: 'server', message: t('EditTokens.validation.conflict') });
      return;
    }
    reset({ name: '' });
  });

  return (
    <div className="cardDatabase-tokens">
      <div className="cardDatabase-tokenList">
        <h3>{t('EditTokens.list')}</h3>
        {editor.tokens.length === 0 && !editor.loading ? (
          <div className="cardDatabase-empty">{t('EditTokens.empty')}</div>
        ) : (
          <ul role="listbox" aria-label={t('EditTokens.list')}>
            {editor.tokens.map((token) => (
              <li
                key={token.name.value}
                {...getRowProps(token.name.value)}
                role="option"
                aria-selected={editor.selected === token}
                className={editor.selected === token ? 'is-selected' : ''}
                onClick={() => editor.select(token.name.value)}
              >
                {token.name.value}
              </li>
            ))}
          </ul>
        )}
        <form className="cardDatabase-addToken" onSubmit={add} aria-label={t('EditTokens.button.add')}>
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label={t('EditTokens.label.newName')}
                disabled={editor.loading || isSubmitting}
                error={fieldState.error?.message}
                touched={fieldState.isTouched || isSubmitted}
              />
            )}
          />
          <Button type="submit" disabled={editor.loading || isSubmitting}>{t('EditTokens.button.add')}</Button>
        </form>
        <Button
          disabled={editor.tokens.length === 0}
          onClick={() => saveTextFile('TK.xml', editor.exportXml())}
        >
          {t('EditTokens.button.export')}
        </Button>
      </div>

      <div className="cardDatabase-tokenData">
        <h3>{t('EditTokens.data')}</h3>
        {editor.selected ? (
          <TokenDataForm token={editor.selected} onSubmit={editor.updateSelected} onRemove={editor.removeSelected} />
        ) : (
          <div className="cardDatabase-empty">{t('EditTokens.selectHint')}</div>
        )}
      </div>

      {editor.error && (
        <div className="cardDatabase-error" role="alert">
          {t(`EditTokens.error.${editor.error.key}`, { error: editor.error.detail })}
        </div>
      )}
    </div>
  );
};

export default EditTokens;
