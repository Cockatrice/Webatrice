import { CircleAlert, ClipboardPaste, FileText, FolderOpen, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';

export function NewDeckButton({ onClick, disabled, variant = 'primary' }: {
  onClick: () => void;
  disabled: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const { t } = useTranslation();
  return (
    <Button variant={variant} icon={<Plus size={15} />} onClick={onClick} disabled={disabled}>
      {t('Decks.list.newDeck')}
    </Button>
  );
}

export function DeckListLoading() {
  const { t } = useTranslation();
  return (
    <div className="h-full min-h-[240px] flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin text-accent" />
        {t('Decks.list.loading')}
      </div>
    </div>
  );
}

export function DeckListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="h-full min-h-[240px] flex items-center justify-center">
      <div role="alert" className="flex flex-col items-center gap-3 text-sm text-text-muted text-center max-w-sm">
        <span className="inline-flex items-center gap-2">
          <CircleAlert size={16} className="text-danger" />
          {message}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md',
            'border border-border-subtle text-text-primary hover:bg-bg-elevated',
          ].join(' ')}
        >
          <RefreshCw size={14} /> {t('Decks.retry')}
        </button>
      </div>
    </div>
  );
}

export function DeckStorageError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-ui border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      <CircleAlert size={16} className="shrink-0 mt-0.5 text-danger" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('Decks.dismiss')}
        className={[
          'shrink-0 rounded p-0.5 text-danger hover:bg-danger/15',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        ].join(' ')}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function DeckListEmpty({ onCreate, onMigrate, onImport, disabled }: {
  onCreate: () => void;
  onMigrate: () => void;
  onImport: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="h-full min-h-[280px] flex items-center justify-center">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-bg-elevated border border-border-subtle mb-3">
          <FileText size={20} className="text-accent" />
        </div>
        <h2 className="text-text-primary font-medium">{t('Decks.list.emptyTitle')}</h2>
        <p className="text-sm text-text-muted mt-1 mb-4">{t('Decks.list.emptyBody')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" icon={<FolderOpen size={15} />} onClick={onMigrate}>
            {t('Decks.list.emptyFromDesktop')}
          </Button>
          <Button icon={<ClipboardPaste size={15} />} onClick={onImport} disabled={disabled}>
            {t('Decks.list.emptyPaste')}
          </Button>
          <NewDeckButton onClick={onCreate} disabled={disabled} variant="secondary" />
        </div>
        <p className="mt-3 text-xs text-text-muted">{t('Decks.list.emptySources')}</p>
      </div>
    </div>
  );
}
