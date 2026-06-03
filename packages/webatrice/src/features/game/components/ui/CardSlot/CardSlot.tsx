import { memo, useCallback } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import { counterColorForId } from './counterColors';
import { useCardSlot } from './useCardSlot';

import './CardSlot.css';

export interface CardSlotProps {
  card: ServerInfo_Card;
  draggable?: boolean;
  isArrowSource?: boolean;
  isArrowTarget?: boolean;
  isSelected?: boolean;
  ownerPlayerId?: number;
  zone?: string;
  dropIndex?: number;
  onClick?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onDoubleClick?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onContextMenu?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onMouseEnter?: (card: ServerInfo_Card) => void;
  onFocus?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onBlur?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
}

interface CardSlotContentProps {
  card: ServerInfo_Card;
  smallUrl: string | null | undefined;
  zone: string | undefined;
  flipClass: string;
}

// Memoized inner so the ~60 CardSlots whose visual state is unchanged on drag
// activation skip re-rendering even though their parent wrappers re-render
// (dnd-kit's useDraggable subscribes to InternalContext inside useCardSlot).
const CardSlotContent = memo(function CardSlotContent({
  card,
  smallUrl,
  zone,
  flipClass,
}: CardSlotContentProps) {
  // Both faces always render so the shared 3D flip (src/styles/card-flip.css) can
  // reveal the other side. restClass holds the correct static side; flipClass adds
  // the keyframe spin only when faceDown changes (see useCardSlot).
  const restClass = card.faceDown ? 'cardflip--back' : 'cardflip--front';
  return (
    <>
      <div className="card-slot__flip-frame">
        <div className={`cardflip ${restClass} ${flipClass}`}>
          <div className="cardflip__face cardflip__face--front card-slot__face-front">
            {smallUrl ? (
              <img className="card-slot__image" src={smallUrl} alt={card.name} draggable={false} />
            ) : (
              <div className="card-slot__image card-slot__image--loading" />
            )}
          </div>
          <div className="cardflip__face cardflip__face--back card-slot__back" aria-label="face-down card" />
        </div>
      </div>

      {!card.faceDown && (card.name || (zone === Enriched.ZoneName.TABLE && card.annotation)) && (
        <div className="card-slot__top">
          {card.name && <div className="card-slot__name">{card.name}</div>}
          {zone === Enriched.ZoneName.TABLE && card.annotation && (
            <div className="card-slot__owner">
              {card.annotation.replace(/^Owner:\s*/i, '')}
            </div>
          )}
        </div>
      )}

      {card.pt && !card.faceDown && (
        <div className="card-slot__pt">{card.pt}</div>
      )}

      {card.counterList.length > 0 && !card.faceDown && (
        <div className="card-slot__counters">
          {card.counterList.map((c) => (
            <span
              key={c.id}
              className={`card-slot__counter card-slot__counter--pos-${c.id}`}
              style={{ background: counterColorForId(c.id) }}
            >
              {c.value}
            </span>
          ))}
        </div>
      )}
    </>
  );
});

function CardSlot({
  card,
  draggable = false,
  isArrowSource = false,
  isArrowTarget = false,
  isSelected = false,
  ownerPlayerId,
  zone,
  dropIndex,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onFocus,
  onBlur,
}: CardSlotProps) {
  const { smallUrl, attributes, listeners, isDragging, dropSide, rootRef, flipClass } = useCardSlot({
    card,
    draggable,
    ownerPlayerId,
    zone,
    dropIndex,
  });

  const handleClick = useCallback(() => onClick?.(ownerPlayerId, zone, card), [onClick, ownerPlayerId, zone, card]);
  const handleDoubleClick = useCallback(() => onDoubleClick?.(ownerPlayerId, zone, card), [onDoubleClick, ownerPlayerId, zone, card]);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => onContextMenu?.(ownerPlayerId, zone, card, e),
    [onContextMenu, ownerPlayerId, zone, card],
  );
  const handleMouseEnter = useCallback(() => onMouseEnter?.(card), [onMouseEnter, card]);
  const handleFocus = useCallback(() => onFocus?.(ownerPlayerId, zone, card), [onFocus, ownerPlayerId, zone, card]);
  const handleBlur = useCallback(() => onBlur?.(ownerPlayerId, zone, card), [onBlur, ownerPlayerId, zone, card]);

  const className = cx('card-slot', {
    'card-slot--tapped': card.tapped,
    'card-slot--face-down': card.faceDown,
    'card-slot--attacking': card.attacking,
    'card-slot--dragging': isDragging,
    'card-slot--selected': isSelected,
    'card-slot--arrow-source': isArrowSource,
    'card-slot--arrow-target': isArrowTarget,
    'card-slot--drop-before': dropSide === 'before',
    'card-slot--drop-after': dropSide === 'after',
  });

  return (
    <div
      ref={rootRef}
      className={className}
      tabIndex={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-testid="card-slot"
      data-card-id={card.id}
      data-card-owner={ownerPlayerId ?? ''}
      data-card-zone={zone ?? ''}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <CardSlotContent card={card} smallUrl={smallUrl} zone={zone} flipClass={flipClass} />
    </div>
  );
}

export default memo(CardSlot);
