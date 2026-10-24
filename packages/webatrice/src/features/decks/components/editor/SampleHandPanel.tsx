import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Hand, Shuffle } from 'lucide-react';

import { imageCandidatesOf } from '@app/services';

import { MIN_SAMPLE_HAND_SIZE } from '../../sampleHand';
import { useSampleHand } from '../../hooks/useSampleHand';
import type { DeckCard } from '../../types';
import { DeckCardImage } from './DeckCardImage';

export interface SampleHandPanelProps {
  cards: readonly DeckCard[];
  showImages: boolean;
  random?: () => number;
}

export function SampleHandPanel({ cards, showImages, random }: SampleHandPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold uppercase tracking-wider text-text-secondary"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Hand size={14} />
        {t('SampleHand.title')}
      </button>
      {open && <SampleHand cards={cards} showImages={showImages} random={random} />}
    </section>
  );
}

function SampleHand({ cards, showImages, random }: SampleHandPanelProps) {
  const { t } = useTranslation();
  const { hand, size, librarySize, setSize, redraw } = useSampleHand(cards, random);

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={redraw}
          disabled={librarySize === 0}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-border-strong bg-bg-elevated',
            'text-sm text-text-primary hover:bg-border-subtle disabled:opacity-40',
          ].join(' ')}
        >
          <Shuffle size={12} /> {t('SampleHand.redraw')}
        </button>
        <input
          type="number"
          min={MIN_SAMPLE_HAND_SIZE}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          aria-label={t('SampleHand.size')}
          title={t('SampleHand.size')}
          className="w-16 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-sm text-text-primary"
        />
      </div>

      {librarySize === 0 ? (
        <p className="mt-3 text-sm text-text-muted">{t('SampleHand.empty')}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('SampleHand.title')}>
          {hand.map((card, i) => (
            <li key={`${card.name}-${i}`} className="w-28">
              {showImages ? (
                <SampleHandImage card={card} />
              ) : (
                <div className="h-36 rounded-md border border-border-subtle bg-bg-elevated p-2 text-xs text-text-primary">
                  {card.name}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SampleHandImage({ card }: { card: DeckCard }) {
  return (
    <DeckCardImage urls={imageCandidatesOf(card)} alt={card.name} className="aspect-[5/7] w-full rounded-md shadow" lazy>
      <div className="h-full rounded-md border border-border-subtle bg-bg-elevated p-2 text-xs text-text-primary">
        {card.name}
      </div>
    </DeckCardImage>
  );
}
