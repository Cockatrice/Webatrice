import { memo, useCallback } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import { counterColorForId } from './counterColors';
import { useCardSlot } from './useCardSlot';

import './CardSlot.css';

// Handlers receive (ownerPlayerId, zone, card) so callers can pass bare references
// (e.g. arrows.handleCardClick) without per-card closures that would defeat memoization.
export interface CardSlotProps {
  card: ServerInfo_Card;
  draggable?: boolean;
  isArrowSource?: boolean;
  ownerPlayerId?: number;
  zone?: string;
  onClick?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onDoubleClick?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onContextMenu?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onMouseEnter?: (card: ServerInfo_Card) => void;
}

function CardSlot({
  card,
  draggable = false,
  isArrowSource = false,
  ownerPlayerId,
  zone,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
}: CardSlotProps) {
  const { smallUrl, attributes, listeners, isDragging, rootRef } = useCardSlot({
    card,
    draggable,
    ownerPlayerId,
    zone,
  });

  const handleClick = useCallback(() => onClick?.(ownerPlayerId, zone, card), [onClick, ownerPlayerId, zone, card]);
  const handleDoubleClick = useCallback(() => onDoubleClick?.(ownerPlayerId, zone, card), [onDoubleClick, ownerPlayerId, zone, card]);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => onContextMenu?.(ownerPlayerId, zone, card, e),
    [onContextMenu, ownerPlayerId, zone, card],
  );
  const handleMouseEnter = useCallback(() => onMouseEnter?.(card), [onMouseEnter, card]);

  const className = cx('card-slot', {
    'card-slot--tapped': card.tapped,
    'card-slot--face-down': card.faceDown,
    'card-slot--attacking': card.attacking,
    'card-slot--dragging': isDragging,
    'card-slot--arrow-source': isArrowSource,
  });

  return (
    <div
      ref={rootRef}
      className={className}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      data-testid="card-slot"
      data-card-id={card.id}
      data-card-owner={ownerPlayerId ?? ''}
      data-card-zone={zone ?? ''}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      {card.faceDown ? (
        <div className="card-slot__back" aria-label="face-down card" />
      ) : (
        smallUrl && (
          <img className="card-slot__image" src={smallUrl} alt={card.name} />
        )
      )}

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
    </div>
  );
}

export default memo(CardSlot);
