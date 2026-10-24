import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { DeckFolderEntry } from '../deckFolders';
import { DeckDialogFrame } from './DeckDialogFrame';

export interface DeleteFolderDialogProps {
  folder: DeckFolderEntry;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteFolderDialog({ folder, onCancel, onConfirm }: DeleteFolderDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <DeckDialogFrame onClose={onCancel} titleId={titleId} role="alertdialog">
      <div
        className="relative w-full max-w-sm rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{t('DeleteFolder.title')}</h2>
        </div>
        <div className="px-5 py-4 text-sm text-text-secondary space-y-2">
          <p>{t('DeleteFolder.body', { name: folder.name })}</p>
          {(folder.deckCount > 0 || folder.folderCount > 0) && (
            <p className="text-danger">
              {t('DeleteFolder.scope', { decks: folder.deckCount, folders: folder.folderCount })}
            </p>
          )}
          <p>{t('DeleteFolder.irreversible')}</p>
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            {t('DeleteFolder.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-md text-sm font-semibold bg-red-500 text-white hover:bg-red-400"
          >
            {t('DeleteFolder.delete')}
          </button>
        </div>
      </div>
    </DeckDialogFrame>
  );
}
