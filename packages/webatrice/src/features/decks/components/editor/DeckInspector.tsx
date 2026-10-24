import { useTranslation } from 'react-i18next';
import { Archive, ImageOff, Info, Layers, Minus, PackageOpen, Plus, Trash2 } from 'lucide-react';

import { Button, ManaSymbols, SectionLabel } from '@app/components';
import { imageCandidatesOf } from '@app/services';
import type { DeckCategory } from '@app/types';

import { priceForCard, type PriceLookup } from '../../pricing';
import { upgradeScryfallImageSize } from '../../scryfallImage';
import type { DeckCard } from '../../types';
import type { InspectedCard } from './editorSelection';
import { DeckCardImage } from './DeckCardImage';

export interface DeckInspectorProps {
  selected: InspectedCard | null;
  index: number;
  deckCards: DeckCard[];
  prices: PriceLookup;
  isCommanderDeck: boolean;
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  onSetCategory: (index: number, category: DeckCategory) => void;
  onChangePrinting: (index: number, card: DeckCard) => void;
  onShowDetails: (card: DeckCard) => void;
  onAdd: (name: string, zone: 'main' | 'side', scryfallId?: string) => void;
}

export function DeckInspector({
  selected,
  index,
  deckCards,
  prices,
  isCommanderDeck,
  onInc,
  onDelete,
  onSetCategory,
  onChangePrinting,
  onShowDetails,
  onAdd,
}: DeckInspectorProps) {
  const { t } = useTranslation();
  const card = index >= 0 ? deckCards[index] ?? null : null;

  return (
    <section className="flex flex-col gap-3" aria-label={t('DeckInspector.title')}>
      <SectionLabel>{t('DeckInspector.title')}</SectionLabel>
      {!selected ? (
        <p className="text-[12px] italic text-text-muted">{t('DeckInspector.empty')}</p>
      ) : (
        <>
          <CardSummary
            card={card ?? selected.preview ?? {
              name: selected.name, quantity: 0, category: selected.category, scryfallId: selected.scryfallId, lookupSource: 'unknown',
            }}
            prices={prices}
          >
            {card ? (
              <Stepper
                quantity={card.quantity}
                name={card.name}
                onDec={() => onInc(index, -1)}
                onInc={() => onInc(index, 1)}
              />
            ) : (
              <Button
                size="sm"
                variant="primary"
                icon={<Plus size={13} />}
                onClick={() => onAdd(selected.name, 'main', selected.scryfallId)}
              >
                {t('DeckInspector.add')}
              </Button>
            )}
          </CardSummary>
          {card ? (
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" icon={<Layers size={13} />} onClick={() => onChangePrinting(index, card)}>
                {t('DeckInspector.changePrinting')}
              </Button>
              {card.category === 'sideboard' ? (
                <Button size="sm" icon={<PackageOpen size={13} />} onClick={() => onSetCategory(index, 'main')}>
                  {t('DeckInspector.toMain')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  icon={<Archive size={13} />}
                  disabled={!!card.isCommander}
                  title={card.isCommander ? t('DeckEditor.rowActions.commanderStaysMain') : undefined}
                  onClick={() => onSetCategory(index, 'sideboard')}
                >
                  {t('DeckInspector.toSideboard')}
                </Button>
              )}
              <Button size="sm" icon={<Info size={13} />} onClick={() => onShowDetails(card)}>
                {t('DeckInspector.details')}
              </Button>
              <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => onDelete(index)}>
                {t(isCommanderDeck && card.isCommander ? 'DeckInspector.removeCommander' : 'DeckInspector.remove')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" icon={<Archive size={13} />} onClick={() => onAdd(selected.name, 'side', selected.scryfallId)}>
                {t('DeckInspector.addToSideboard')}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CardSummary({ card, prices, children }: { card: DeckCard; prices: PriceLookup; children: React.ReactNode }) {
  const { t } = useTranslation();
  const imageUris = imageCandidatesOf(card)
    .map(upgradeScryfallImageSize)
    .filter((url): url is string => Boolean(url));
  const price = priceForCard(prices, card)?.usd;
  const stats = card.power != null && card.toughness != null ? `${card.power}/${card.toughness}` : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="aspect-[5/7] w-full overflow-hidden border border-border-subtle bg-bg-elevated"
        style={{ borderRadius: '4.75% / 3.4%' }}
      >
        <DeckCardImage urls={imageUris} alt={card.name}>
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-[12px] text-text-muted">
            <ImageOff size={20} />
            {t('DeckInspector.noImage')}
          </div>
        </DeckCardImage>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-[15px] font-semibold leading-snug text-text-primary">{card.name}</span>
          {card.manaCost && <ManaSymbols cost={card.manaCost} size={14} className="mt-0.5 shrink-0" />}
        </div>
        {card.typeLine && <span className="text-[12px] leading-snug text-text-secondary">{card.typeLine}</span>}
        {(card.set || stats || price != null) && (
          <div className="flex items-baseline gap-2 text-[12px] text-text-muted">
            {(card.set || stats) && (
              <span>
                {card.set && <span className="uppercase">{card.set}</span>}
                {card.set && stats && ' · '}
                {stats}
              </span>
            )}
            {price != null && (
              <span className="ml-auto text-[13px] font-semibold tabular-nums text-success">
                {t('DeckInspector.price', { price: price.toFixed(2) })}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Stepper({ quantity, name, onDec, onInc }: { quantity: number; name: string; onDec: () => void; onInc: () => void }) {
  const { t } = useTranslation();
  const button = [
    'inline-flex h-full w-8 items-center justify-center text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
    'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
  ].join(' ');
  return (
    <span
      className="inline-flex h-8 items-center rounded-ui border border-border-strong"
      role="group"
      aria-label={t('DeckInspector.quantity')}
    >
      <button type="button" aria-label={t('DeckInspector.decrease', { card: name })} className={button} onClick={onDec}>
        <Minus size={14} />
      </button>
      <span className="w-7 text-center text-[13px] font-semibold tabular-nums text-text-primary" aria-live="polite">{quantity}</span>
      <button type="button" aria-label={t('DeckInspector.increase', { card: name })} className={button} onClick={onInc}>
        <Plus size={14} />
      </button>
    </span>
  );
}
