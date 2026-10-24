import { useEffect, useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { z } from 'zod';
import { Link2 } from 'lucide-react';

import { parseDeckShareLink, type DeckShareLink } from '../deckSharing';
import { DeckDialogFrame } from './DeckDialogFrame';

export function buildOpenShareLinkSchema(t: TFunction) {
  return z.object({
    link: z.string().superRefine((value, ctx) => {
      const parsed = parseDeckShareLink(value);
      if ('problem' in parsed) {
        ctx.addIssue({ code: 'custom', message: t(`OpenShareLink.problem.${parsed.problem}`) });
      }
    }),
  });
}

type OpenShareLinkValues = z.infer<ReturnType<typeof buildOpenShareLinkSchema>>;

export interface OpenShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onOpen: (link: DeckShareLink) => void;
}

export function OpenShareLinkDialog({ open, onClose, onOpen }: OpenShareLinkDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const schema = useMemo(() => buildOpenShareLinkSchema(t), [t]);
  const { control, handleSubmit, reset } = useForm<OpenShareLinkValues>({
    defaultValues: { link: '' },
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!open) {
      reset({ link: '' });
    }
  }, [open, reset]);

  if (!open) {
    return null;
  }

  const submit = handleSubmit(({ link }) => {
    const parsed = parseDeckShareLink(link);
    if (!('problem' in parsed)) {
      onOpen(parsed);
    }
  });

  return (
    <DeckDialogFrame onClose={onClose} titleId={titleId}>
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{t('OpenShareLink.title')}</h2>
        </div>
        <div className="px-5 py-4">
          <Controller
            name="link"
            control={control}
            render={({ field, fieldState }) => (
              <label className="block">
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  {t('OpenShareLink.label')}
                </span>
                <input
                  {...field}
                  type="text"
                  autoFocus
                  aria-invalid={fieldState.invalid}
                  className={[
                    'mt-1 w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary',
                    'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
                  ].join(' ')}
                />
                {fieldState.error && (
                  <span role="alert" className="mt-1 block text-xs text-danger">{fieldState.error.message}</span>
                )}
              </label>
            )}
          />
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            {t('OpenShareLink.cancel')}
          </button>
          <button
            type="submit"
            className={[
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold',
              'bg-accent text-on-accent hover:bg-accent-hover',
            ].join(' ')}
          >
            <Link2 size={13} /> {t('OpenShareLink.submit')}
          </button>
        </div>
      </form>
    </DeckDialogFrame>
  );
}
