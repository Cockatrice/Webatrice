import { useId } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { DeckDialogFrame } from './DeckDialogFrame';

export interface DeleteDeckDialogProps {
  deckName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteDeckDialog({ deckName, onCancel, onConfirm }: DeleteDeckDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const messageId = useId();

  return (
    <DeckDialogFrame onClose={onCancel} titleId={titleId} descriptionId={messageId} role="alertdialog">
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{t('DeleteDeckDialog.title')}</h2>
        </div>
        <div id={messageId} className="px-5 py-4 text-sm text-text-secondary">
          <Trans
            i18nKey="DeleteDeckDialog.message"
            values={{ name: deckName }}
            components={{ name: <span className="text-text-primary font-medium" /> }}
          />
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={[
              'px-4 py-1.5 rounded-md text-sm font-medium text-text-secondary',
              'hover:text-text-primary hover:bg-bg-elevated transition-colors',
            ].join(' ')}
          >
            {t('Common.action.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-md text-sm font-semibold bg-red-500 text-white hover:bg-red-400 transition-colors"
          >
            {t('Common.action.delete')}
          </button>
        </div>
      </div>
    </DeckDialogFrame>
  );
}
