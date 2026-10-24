import { useTranslation } from 'react-i18next';
import { Download, Lock, X } from 'lucide-react';

import type { DeckCategory, ParsedDeck } from '@app/types';

import { formatDisplayLabel } from '../deckSummary';

export interface ReadOnlyDeckProps {
  deck: ParsedDeck;
  onImport?: () => void;
  onClose: () => void;
}

const SECTIONS: DeckCategory[] = ['main', 'sideboard'];

export function ReadOnlyDeck({ deck, onImport, onClose }: ReadOnlyDeckProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={deck.name}
      className="rounded-lg bg-bg-surface border border-border-subtle overflow-hidden"
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <div className="flex-1 min-w-0">
          <h2 className="font-modern text-lg font-semibold text-text-primary truncate">{deck.name}</h2>
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <Lock size={11} /> {t('ReadOnlyDeck.readOnly')}
            {deck.format && <span>· {formatDisplayLabel(deck.format, t)}</span>}
          </p>
        </div>
        {onImport && (
          <button
            type="button"
            onClick={onImport}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold',
              'bg-accent text-on-accent hover:bg-accent-hover',
            ].join(' ')}
          >
            <Download size={13} /> {t('ReadOnlyDeck.import')}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
          title={t('ReadOnlyDeck.close')}
          aria-label={t('ReadOnlyDeck.close')}
        >
          <X size={14} />
        </button>
      </header>
      <div className="px-4 py-3 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((category) => {
          const cards = deck.cards.filter((card) => card.category === category);
          if (cards.length === 0) {
            return null;
          }
          const count = cards.reduce((sum, card) => sum + card.quantity, 0);
          return (
            <div key={category}>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1">
                {t(`ReadOnlyDeck.${category}`)} · {t('ReadOnlyDeck.cardCount', { count })}
              </h3>
              <ul className="text-sm text-text-primary space-y-0.5">
                {cards.map((card, i) => (
                  <li key={`${card.name}-${i}`} className="flex gap-2">
                    <span className="tabular-nums text-text-muted w-6 text-right">{card.quantity}</span>
                    <span className="truncate">{card.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
