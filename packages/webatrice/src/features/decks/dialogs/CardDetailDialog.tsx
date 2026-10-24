import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowLeft, Crown, Layers, Loader2, Minus, PackageOpen, Plus, Trash2, X } from 'lucide-react';

import { CardRelatedLinks, ManaSymbols, relatedCardKey, SymbolText } from '@app/components';
import { selectCardFace } from '@app/services';
import type { DeckCategory } from '@app/types';

import { canAddBrowsedCard, describeCardDetail, resolveDetailRow } from '../cardDetail';
import { useCardDetail } from '../hooks/useCardDetail';
import { priceForCard, type PriceLookup } from '../pricing';
import type { DeckCard } from '../types';
import { DeckDialogFrame } from './DeckDialogFrame';

const QUANTITY_BUTTON_CLASS =
  'p-1 rounded hover:bg-bg-base text-text-muted hover:text-text-primary disabled:opacity-40 '
  + 'disabled:cursor-not-allowed disabled:hover:bg-transparent';

export interface CardDetailDialogProps {
  snapshot: DeckCard | null;
  deckCards: DeckCard[];
  isCommanderDeck: boolean;
  prices: PriceLookup;
  onClose: () => void;
  onInc: (index: number) => void;
  onDec: (index: number) => void;
  onSetCategory: (index: number, category: DeckCategory) => void;
  onSetCommander: (index: number, isCommander: boolean) => void;
  onChangePrinting: (index: number, card: DeckCard) => void;
  onDelete: (index: number) => void;
  onAdd: (name: string) => Promise<void> | void;
}

export function CardDetailDialog({
  snapshot,
  deckCards,
  isCommanderDeck,
  prices,
  onClose,
  onInc,
  onDec,
  onSetCategory,
  onSetCommander,
  onChangePrinting,
  onDelete,
  onAdd,
}: CardDetailDialogProps) {
  const { t } = useTranslation();
  const { detail, detailLoading, browsed, pending, browse, back } = useCardDetail(snapshot);
  const titleId = useId();

  if (!snapshot) {
    return null;
  }

  const liveIndex = resolveDetailRow(deckCards, snapshot, browsed);
  const liveCard = liveIndex >= 0 ? deckCards[liveIndex] : null;
  const removed = !browsed && !liveCard;
  const browsedNotInDeck = !!browsed && !liveCard;

  const activeCardName = browsed?.name ?? snapshot.name;
  const face = selectCardFace(detail, activeCardName);
  const view = describeCardDetail({
    detail,
    face,
    activeName: activeCardName,
    liveCard,
    fallback: browsed ? {} : snapshot,
  });

  const priceInfo = priceForCard(prices, liveCard ?? (browsed ? { name: browsed.name } as DeckCard : snapshot));

  return (
    <DeckDialogFrame onClose={onClose} titleId={titleId}>
      <div
        className={[
          'relative w-full max-w-3xl rounded-xl bg-bg-surface border',
          'border-border-subtle shadow-glow p-6 max-h-[calc(100vh-2rem)] overflow-y-auto',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          aria-label={t('Common.action.close')}
        >
          <X size={18} />
        </button>

        <div data-dialog-content className="grid gap-6" style={{ gridTemplateColumns: '300px 1fr' }}>
          <div>
            {view.imageUrl ? (
              <img
                src={view.imageUrl}
                alt={activeCardName}
                className="w-full rounded-lg shadow-glow"
                draggable={false}
              />
            ) : detailLoading ? (
              <div className="w-full aspect-[5/7] rounded-lg bg-bg-elevated border border-border-subtle flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-text-muted" />
              </div>
            ) : (
              <div
                className={[
                  'w-full aspect-[5/7] rounded-lg bg-bg-elevated border',
                  'border-border-subtle flex items-center justify-center text-xs text-text-muted',
                ].join(' ')}
              >
                {t('CardDetailDialog.noImage')}
              </div>
            )}
          </div>

          <div className="min-w-0 flex flex-col gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <h2 id={titleId} className="font-modern text-xl font-bold text-text-primary truncate">
                  {view.name}
                </h2>
                {typeof view.cmc === 'number' && (
                  <span className="text-xs text-text-muted tabular-nums shrink-0">
                    {t('CardDetailDialog.cmc', { cmc: view.cmc })}
                  </span>
                )}
              </div>
              {view.manaCost && (
                <div className="mt-1">
                  <ManaSymbols cost={view.manaCost} size={16} />
                </div>
              )}
            </div>

            {view.typeLine && (
              <div className="text-sm text-text-secondary italic">{view.typeLine}</div>
            )}

            {view.oracle && (
              <div className="text-sm text-text-primary whitespace-pre-line leading-relaxed">
                <SymbolText text={view.oracle} size={13} />
              </div>
            )}

            {view.flavor && (
              <div className="text-sm text-text-muted italic whitespace-pre-line leading-relaxed border-t border-border-subtle pt-3">
                <SymbolText text={view.flavor} size={13} />
              </div>
            )}

            {browsed && (
              <button
                type="button"
                onClick={back}
                className={[
                  'inline-flex items-center gap-1.5 self-start px-2 py-1',
                  'rounded-md text-xs font-medium text-text-primary',
                  'bg-bg-elevated hover:bg-border-subtle border border-border-subtle transition-colors',
                ].join(' ')}
                title={t('CardDetailDialog.backTo', { name: snapshot.name })}
              >
                <ArrowLeft size={12} /> {t('CardDetailDialog.backTo', { name: snapshot.name })}
              </button>
            )}
            {detail && !browsed && (
              <CardRelatedLinks
                faces={detail.card_faces}
                allParts={detail.all_parts}
                parentName={detail.name}
                parentTypeLine={face?.type_line ?? detail.type_line}
                currentFaceName={face?.name ?? detail.name}
                pendingKey={pending ? relatedCardKey(pending) : undefined}
                onNavigate={browse}
              />
            )}

            {!browsedNotInDeck && (
              <CardDetailActions
                card={liveCard}
                removed={removed}
                isCommanderDeck={isCommanderDeck}
                onInc={() => liveIndex >= 0 && onInc(liveIndex)}
                onDec={() => liveIndex >= 0 && onDec(liveIndex)}
                closeAfter={(fn) => () => {
                  fn();
                  onClose();
                }}
                onChangePrinting={() => {
                  if (liveCard && liveIndex >= 0) {
                    onChangePrinting(liveIndex, liveCard);
                  }
                }}
                onToggleCommander={() => {
                  if (liveIndex >= 0) {
                    onSetCommander(liveIndex, !liveCard?.isCommander);
                  }
                }}
                onMove={(category) => {
                  if (liveIndex >= 0) {
                    onSetCategory(liveIndex, category);
                  }
                }}
                onDelete={() => {
                  if (liveIndex >= 0) {
                    onDelete(liveIndex);
                  }
                }}
              />
            )}

            {browsedNotInDeck && browsed && canAddBrowsedCard(browsed.kind) && (
              <div className="mt-2 border-t border-border-subtle pt-3 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  {t('CardDetailDialog.actions')}
                </div>
                <ActionButton
                  icon={<Plus size={14} />}
                  label={t('CardDetailDialog.addToDeck')}
                  onClick={() => {
                    void onAdd(browsed.name);
                  }}
                />
              </div>
            )}

            {priceInfo?.usd != null && (
              <div className="mt-1 pt-2 border-t border-border-subtle">
                {priceInfo.tcgplayer ? (
                  <a
                    href={priceInfo.tcgplayer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={[
                      'w-full inline-flex items-center justify-between gap-2 px-3 py-1.5',
                      'rounded-md border transition-colors bg-accent-secondary/50',
                      'hover:bg-accent-secondary border-accent/40 hover:border-accent text-white shadow-glow',
                    ].join(' ')}
                  >
                    <span className="text-sm font-medium">{t('CardDetailDialog.buy')}</span>
                    <span className="tabular-nums text-sm font-semibold">
                      ${priceInfo.usd.toFixed(2)}
                    </span>
                  </a>
                ) : (
                  <div
                    className={[
                      'w-full inline-flex items-center justify-between gap-2 px-3 py-1.5',
                      'rounded-md border bg-accent-secondary/30 border-accent/30 text-text-primary',
                    ].join(' ')}
                  >
                    <span className="text-sm font-medium">{t('PrintingPicker.priceUsd')}</span>
                    <span className="tabular-nums text-sm font-semibold">
                      ${priceInfo.usd.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(view.setCode || view.collectorNumber) && (
              <div className="text-xs text-text-muted mt-1 pt-2 border-t border-border-subtle uppercase tracking-wider">
                {view.setCode?.toUpperCase() ?? '?'} · #{view.collectorNumber ?? '?'}
              </div>
            )}
          </div>
        </div>
      </div>
    </DeckDialogFrame>
  );
}

function CardDetailActions({
  card,
  removed,
  isCommanderDeck,
  onInc,
  onDec,
  closeAfter,
  onChangePrinting,
  onToggleCommander,
  onMove,
  onDelete,
}: {
  card: DeckCard | null;
  removed: boolean;
  isCommanderDeck: boolean;
  onInc: () => void;
  onDec: () => void;
  closeAfter: (fn: () => void) => () => void;
  onChangePrinting: () => void;
  onToggleCommander: () => void;
  onMove: (category: DeckCategory) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const cardIsCommander = !!card?.isCommander;
  const cardIsSideboard = card?.category === 'sideboard';
  return (
    <div className="mt-2 border-t border-border-subtle pt-3 space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {t('CardDetailDialog.actions')}
      </div>

      <div className="flex items-center justify-between px-3 py-2 rounded-md bg-bg-elevated border border-border-subtle">
        <span className="text-sm text-text-secondary">
          {t('CardDetailDialog.quantity')}{' '}
          {removed && (
            <span className="text-xs text-text-muted">· {t('CardDetailDialog.removed')}</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDec}
            disabled={removed}
            className={QUANTITY_BUTTON_CLASS}
            aria-label={t('CardDetailDialog.decrease')}
          >
            <Minus size={14} />
          </button>
          <span className="w-6 text-center tabular-nums text-text-primary font-semibold">
            {card?.quantity ?? 0}
          </span>
          <button
            type="button"
            onClick={onInc}
            disabled={removed}
            className={QUANTITY_BUTTON_CLASS}
            aria-label={t('CardDetailDialog.increase')}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <ActionButton
        icon={<Layers size={14} />}
        label={t('DeckEditor.rowActions.changePrinting')}
        disabled={removed}
        onClick={closeAfter(onChangePrinting)}
      />
      {isCommanderDeck && (
        <ActionButton
          icon={<Crown size={14} className={cardIsCommander ? 'text-warning' : ''} />}
          label={cardIsCommander ? t('DeckEditor.rowActions.unmarkCommander') : t('DeckEditor.rowActions.markCommander')}
          disabled={removed}
          onClick={closeAfter(onToggleCommander)}
        />
      )}
      {cardIsSideboard ? (
        <ActionButton
          icon={<PackageOpen size={14} />}
          label={t('DeckEditor.rowActions.moveToMain')}
          disabled={removed}
          onClick={closeAfter(() => onMove('main'))}
        />
      ) : (
        <ActionButton
          icon={<Archive size={14} />}
          label={t('DeckEditor.rowActions.moveToSideboard')}
          disabled={removed || cardIsCommander}
          onClick={closeAfter(() => onMove('sideboard'))}
        />
      )}
      <ActionButton
        icon={<Trash2 size={14} />}
        label={t('CardDetailDialog.removeFromDeck')}
        danger
        disabled={removed}
        onClick={closeAfter(onDelete)}
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors',
        danger
          ? 'bg-bg-elevated border-border-subtle text-danger hover:bg-red-500/10 hover:border-red-500/40'
          : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
