import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Check, Copy, Link2 } from 'lucide-react';

import { formatShareExpiry } from '../deckSharing';
import { copyShareLink, type DeckShareCreateState } from '../hooks/useDeckSharing';
import { DeckDialogFrame } from './DeckDialogFrame';

const MAX_SHARE_NAME_LENGTH = 64;

const shareDeckSchema = z.object({ name: z.string().max(MAX_SHARE_NAME_LENGTH) });

type ShareDeckValues = z.infer<typeof shareDeckSchema>;

export interface ShareDeckDialogProps {
  open: boolean;
  defaultName: string;
  state: DeckShareCreateState;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function ShareDeckDialog({ open, defaultName, state, onClose, onCreate }: ShareDeckDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { control, handleSubmit, reset } = useForm<ShareDeckValues>({
    defaultValues: { name: defaultName },
    resolver: zodResolver(shareDeckSchema),
  });
  const [copy, setCopy] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      reset({ name: defaultName });
      setCopy('idle');
    }
  }, [open, defaultName, reset]);

  if (!open) {
    return null;
  }

  const submit = handleSubmit(({ name }) => onCreate(name.trim() || defaultName));
  const created = state.status === 'created' ? state : null;
  const createdText = created ? t(created.copied ? 'DeckSharing.createdCopied' : 'DeckSharing.created') : '';
  const copyText = { idle: createdText, copying: '', copied: t('DeckSharing.copied'), failed: t('DeckSharing.copyFailed') }[copy];
  const announcement = state.status === 'pending' ? t('DeckSharing.creating') : created ? copyText : '';

  const copyLink = async (link: string) => {
    setCopy('copying');
    const copied = await copyShareLink(link);
    setCopy(copied ? 'copied' : 'failed');
    if (!copied) {
      linkRef.current?.focus();
      linkRef.current?.select();
    }
  };

  return (
    <DeckDialogFrame onClose={onClose} titleId={titleId}>
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{t('DeckSharing.title')}</h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-text-secondary">
          {created ? (
            <>
              <p>{t(created.copied ? 'DeckSharing.createdCopied' : 'DeckSharing.created')}</p>
              <div className="flex items-center gap-2">
                <input
                  ref={linkRef}
                  type="text"
                  readOnly
                  autoFocus
                  value={created.link}
                  aria-label={t('DeckSharing.linkLabel')}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    void copyLink(created.link);
                  }}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium shrink-0',
                    'text-text-primary bg-bg-elevated border border-border-strong hover:bg-border-subtle',
                  ].join(' ')}
                >
                  {copy === 'copied' ? <Check size={13} /> : <Copy size={13} />}
                  {t(copy === 'copied' ? 'DeckSharing.copied' : 'DeckSharing.copy')}
                </button>
              </div>
              {copy === 'failed' && <p className="text-danger">{t('DeckSharing.copyFailed')}</p>}
              <p>{t('DeckSharing.expires', { date: formatShareExpiry(created.expiresAt) })}</p>
            </>
          ) : (
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <label className="block">
                  <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {t('DeckSharing.nameLabel')}
                  </span>
                  <input
                    {...field}
                    type="text"
                    autoFocus
                    maxLength={MAX_SHARE_NAME_LENGTH}
                    disabled={state.status === 'pending'}
                    aria-invalid={fieldState.invalid}
                    className={[
                      'mt-1 w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary',
                      'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
                    ].join(' ')}
                  />
                </label>
              )}
            />
          )}
          {state.status === 'pending' && <p>{t('DeckSharing.creating')}</p>}
          <p role="status" className="sr-only">{announcement}</p>
          {state.status === 'failed' && <p role="alert" className="text-danger">{state.message}</p>}
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            {t(created ? 'DeckSharing.close' : 'DeckSharing.cancel')}
          </button>
          {!created && (
            <button
              type="submit"
              disabled={state.status === 'pending'}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold',
                'bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              <Link2 size={13} /> {t('DeckSharing.create')}
            </button>
          )}
        </div>
      </form>
    </DeckDialogFrame>
  );
}
