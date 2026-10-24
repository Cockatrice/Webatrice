import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Loader2 } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { RouteEnum } from '@app/types';

import { deckEditorGridStyle } from './editorLayout';

export function DeckEditorSkeleton() {
  const { t } = useTranslation();
  return (
    <Layout>
      <AuthGuard />
      <div className="grid h-full min-h-0 bg-bg-base" style={deckEditorGridStyle({ inspectorColumn: true })}>
        <div className="flex flex-col gap-3 border-r border-border-subtle bg-bg-surface p-pad">
          <div className="h-9 w-full animate-pulse rounded-ui bg-bg-elevated" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-ui bg-bg-elevated" />
          ))}
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="h-4 w-40 animate-pulse rounded bg-bg-elevated" />
          <div className="h-7 w-3/5 animate-pulse rounded bg-bg-elevated" />
          <div className="mt-2 flex flex-col gap-3">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-6 animate-pulse rounded bg-bg-elevated" />
                <div
                  className="h-4 animate-pulse rounded bg-bg-elevated"
                  style={{ width: `${35 + ((i * 7) % 25)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 border-l border-border-subtle bg-bg-surface p-pad">
          <div className="aspect-[5/7] w-full animate-pulse rounded-[8px] bg-bg-elevated" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-bg-elevated" />
          <div className="h-20 w-full animate-pulse rounded-ui bg-bg-elevated" />
          <div className="mt-auto flex items-center justify-center gap-2 text-xs italic text-text-muted">
            <Loader2 size={12} className="animate-spin text-accent" />
            {t('DeckEditor.shell.loadingDeck')}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export function DeckNotFound({ reason }: { reason: string | null }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <Layout>
      <AuthGuard />
      <div className="h-full flex flex-col items-center justify-center bg-bg-base gap-3">
        <CircleAlert size={32} className="text-danger" />
        <div className="text-text-primary font-medium">
          {reason ? t('DeckEditor.loadFailedTitle') : t('DeckEditor.shell.notFoundTitle')}
        </div>
        <div className="text-sm text-text-muted">
          {reason ?? t('DeckEditor.shell.notFoundBody')}
        </div>
        <button
          type="button"
          onClick={() => navigate(RouteEnum.DECKS)}
          className={[
            'mt-3 inline-flex h-9 items-center gap-1.5 rounded-ui bg-accent px-4 text-[13px] font-medium text-on-accent',
            'transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          ].join(' ')}
        >
          <ArrowLeft size={14} /> {t('DeckEditor.shell.backToDecks')}
        </button>
      </div>
    </Layout>
  );
}

export function EmptyCardsHint({ isMtg }: { isMtg: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="text-sm text-text-muted italic text-center mt-6 mb-24">
        <Trans
          i18nKey={isMtg ? 'DeckEditor.shell.emptyMtg' : 'DeckEditor.shell.emptyPlain'}
          components={{ hl: <span className="font-semibold text-text-primary" /> }}
        />
      </div>
      <div className="text-center text-text-muted">
        <div className="text-sm">{t('DeckEditor.shell.noCards')}</div>
      </div>
    </>
  );
}
