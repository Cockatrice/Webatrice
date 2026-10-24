import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderInput } from 'lucide-react';

import type { FlatDeck } from '../deckTree';
import { DeckDialogFrame } from './DeckDialogFrame';

export interface MoveDeckDialogProps {
  deck: FlatDeck;
  folderPaths: readonly string[];
  onCancel: () => void;
  onMove: (targetPath: string) => void;
}

export function MoveDeckDialog({ deck, folderPaths, onCancel, onMove }: MoveDeckDialogProps) {
  const { t } = useTranslation();
  const targets = folderPaths.filter((p) => p !== deck.path);
  const [target, setTarget] = useState(targets[0] ?? '');
  const titleId = useId();

  return (
    <DeckDialogFrame onClose={onCancel} titleId={titleId}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (targets.length > 0) {
            onMove(target);
          }
        }}
        className="relative w-full max-w-sm rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 id={titleId} className="font-modern text-lg font-semibold text-text-primary">{t('MoveDeck.title', { name: deck.name })}</h2>
        </div>
        <div className="px-5 py-4 space-y-2">
          <label className="block">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">{t('MoveDeck.target')}</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary"
            >
              {targets.map((path) => (
                <option key={path} value={path}>{path || t('DeckFolders.root')}</option>
              ))}
            </select>
          </label>
          <p className="text-xs text-text-muted">{t('MoveDeck.howItWorks')}</p>
        </div>
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            {t('MoveDeck.cancel')}
          </button>
          <button
            type="submit"
            disabled={targets.length === 0}
            className={[
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold bg-accent text-on-accent',
              'hover:bg-accent-hover disabled:opacity-40',
            ].join(' ')}
          >
            <FolderInput size={13} /> {t('MoveDeck.move')}
          </button>
        </div>
      </form>
    </DeckDialogFrame>
  );
}
