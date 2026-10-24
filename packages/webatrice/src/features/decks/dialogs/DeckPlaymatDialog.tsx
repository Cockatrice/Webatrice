import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { games } from '@cockatrice/datatrice';
import { PlaymatCropEditor } from '@app/components';
import { lookupCard, preferredPrinting, type PrintingSummary } from '@app/services';
import { PLAYMAT_NAME_MAX_LENGTH } from '@app/types';

import { useQuickAddSuggestions } from '../hooks/useQuickAddSuggestions';
import { DeckDialogFrame } from './DeckDialogFrame';

const CROP_LABEL_KEYS = {
  marginPctL: 'PlaymatSettings.crop.leftMargin',
  marginPctR: 'PlaymatSettings.crop.rightMargin',
  verticalOffset: 'PlaymatSettings.crop.verticalOffset',
  zoom: 'PlaymatSettings.crop.zoom',
} as const;

export function DeckPlaymatDialog({ playmat, onClose, onSave }: {
  playmat: games.Playmat | null;
  onClose: () => void;
  onSave: (playmat: games.Playmat | null) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const schema = useMemo(() => z.object({
    cardName: z.string().trim().max(PLAYMAT_NAME_MAX_LENGTH, t('DeckPlaymat.nameTooLong', { max: PLAYMAT_NAME_MAX_LENGTH })),
    cardProviderId: z.string(),
    params: z.object({
      marginPctL: z.number().min(0).max(0.95), marginPctR: z.number().min(0).max(0.95),
      verticalOffset: z.number().min(0).max(1), zoom: z.number().min(0.1).max(4),
    }),
  }), [t]);
  const { control, register, watch, getValues, setValue, handleSubmit, setError,
    formState: { errors, isSubmitting } } = useForm<games.Playmat>({
      resolver: zodResolver(schema),
      defaultValues: playmat ?? { cardName: '', cardProviderId: '', params: { ...games.DEFAULT_PLAYMAT_PARAMS } },
    });
  const draft = watch();
  const cardInput = register('cardName', { onChange: (event) => {
    setValue('cardProviderId', event.target.value.trim() === playmat?.cardName ? playmat.cardProviderId : '');
  } });
  const suggestionsId = useId();
  const { suggestions } = useQuickAddSuggestions(draft.cardName);
  const [printings, setPrintings] = useState<PrintingSummary[]>([]);
  const [lookupError, setLookupError] = useState(false);
  useEffect(() => {
    let active = true;
    setPrintings([]);
    setLookupError(false);
    const name = draft.cardName.trim();
    if (!name) {
      return;
    }
    const timer = window.setTimeout(() => {
      void lookupCard(name).then((card) => {
        if (active) {
          setPrintings(card.printings);
          if (name !== playmat?.cardName && !getValues('cardProviderId')) {
            setValue('cardProviderId', preferredPrinting(card)?.scryfallId ?? '');
          }
        }
      }).catch(() => {
        if (active) {
          setLookupError(true);
        }
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft.cardName, playmat?.cardName, getValues, setValue]);

  const submit = handleSubmit(async (value) => {
    if (!value.cardName && !value.cardProviderId) {
      onSave(playmat ? { ...playmat, params: value.params } : null);
      return;
    }
    if (value.cardName !== playmat?.cardName) {
      try {
        const card = await lookupCard(value.cardName);
        if (!mounted.current) {
          return;
        }
        if (!card.found) {
          setError('cardName', { message: t('DeckPlaymat.unknownCard') });
          return;
        }
        if (!value.cardProviderId) {
          value.cardProviderId = preferredPrinting(card)?.scryfallId ?? '';
        }
      } catch {
        if (mounted.current) {
          setError('cardName', { message: t('DeckPlaymat.lookupFailed') });
        }
        return;
      }
    }
    onSave(value);
  });
  const inputClass = 'block w-full rounded border border-border-subtle bg-bg-elevated p-2 text-sm';
  const params = [
    { key: 'marginPctL', min: 0, max: 0.95 },
    { key: 'marginPctR', min: 0, max: 0.95 },
    { key: 'verticalOffset', min: 0, max: 1 },
    { key: 'zoom', min: 0.1, max: 4 },
  ] as const;
  return (
    <DeckDialogFrame onClose={onClose} titleId={titleId}>
      <form onSubmit={submit} noValidate className={[
        'relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl',
        'border border-border-subtle bg-bg-surface p-5 space-y-4',
      ].join(' ')}>
        <h2 id={titleId} className="text-lg font-semibold">{t('DeckPlaymat.title')}</h2>
        <fieldset disabled={isSubmitting} className="space-y-3">
          <label className="block">
            {t('DeckPlaymat.card')}
            <input {...cardInput} list={suggestionsId}
              className={inputClass} autoFocus maxLength={PLAYMAT_NAME_MAX_LENGTH} aria-invalid={!!errors.cardName} />
          </label>
          <datalist id={suggestionsId}>
            {suggestions.map((card) => <option key={card.name} value={card.name} />)}
          </datalist>
          {errors.cardName && <p role="alert">{errors.cardName.message}</p>}
          {lookupError && <p role="alert">{t('DeckPlaymat.lookupFailed')}</p>}
          <label className="block">
            {t('DeckPlaymat.printing')}
            <Controller name="cardProviderId" control={control} render={({ field }) => (
              <select {...field} className={inputClass}>
                <option value="">{t('DeckPlaymat.defaultPrinting')}</option>
                {draft.cardProviderId && !printings.some((printing) => printing.scryfallId === draft.cardProviderId) && (
                  <option value={draft.cardProviderId}>{draft.cardProviderId}</option>
                )}
                {printings.filter((printing) => printing.scryfallId).map((printing) => (
                  <option key={printing.scryfallId} value={printing.scryfallId}>
                    {printing.set} {printing.collectorNumber}
                  </option>
                ))}
              </select>
            )} />
          </label>
          <PlaymatCropEditor playmat={draft} onChange={(value) => {
            for (const { key } of params) {
              setValue(`params.${key}`, value[key]);
            }
          }} />
          <details>
            <summary>{t('DeckPlaymat.numeric')}</summary>
            {params.map(({ key, min, max }) => (
              <Controller key={key} name={`params.${key}`} control={control} render={({ field }) => (
                <label key={key} className="block">
                  {t(CROP_LABEL_KEYS[key])}
                  <input {...field} value={Number.isNaN(field.value) ? '' : field.value}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    type="number" min={min} max={max} step="0.001" className={inputClass}
                    aria-invalid={!!errors.params?.[key]} />
                </label>
              )} />
            ))}
          </details>
          {errors.params && <p role="alert">{t('DeckPlaymat.invalidParams')}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => onSave(null)}>{t('DeckPlaymat.remove')}</button>
            <button type="button" onClick={onClose}>{t('Common.action.cancel')}</button>
            <button type="submit">{t('DeckPlaymat.ok')}</button>
          </div>
        </fieldset>
      </form>
    </DeckDialogFrame>
  );
}
