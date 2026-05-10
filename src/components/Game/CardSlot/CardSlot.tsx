import { memo } from 'react';

import type { Data } from '@app/types';
import { cx } from '@app/utils';

import { counterColorForId } from './counterColors';
import { useCardSlot } from './useCardSlot';

import './CardSlot.css';

export interface CardSlotProps {
  card: Data.ServerInfo_Card;
  draggable?: boolean;
  isArrowSource?: boolean;
  /** The player that owns this card (matches desktop's `getOwner()`). Kept
   *  as `ownerPlayerId`, not `sourcePlayerId`, because it reflects the card
   *  in the game state rather than any drag origin. */
  ownerPlayerId?: number;
  /** Display name of the owning player, painted under the card name. Only
   *  passed by battlefield callers; other zones leave it undefined so the
   *  owner pill is suppressed. */
  ownerPlayerName?: string;
  zone?: string;
  onClick?: (card: Data.ServerInfo_Card) => void;
  onDoubleClick?: (card: Data.ServerInfo_Card) => void;
  onContextMenu?: (card: Data.ServerInfo_Card, event: React.MouseEvent) => void;
  onMouseEnter?: (card: Data.ServerInfo_Card) => void;
}

function CardSlot({
  card,
  draggable = false,
  isArrowSource = false,
  ownerPlayerId,
  ownerPlayerName,
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
      onClick={() => onClick?.(card)}
      onDoubleClick={() => onDoubleClick?.(card)}
      onContextMenu={(e) => onContextMenu?.(card, e)}
      onMouseEnter={() => onMouseEnter?.(card)}
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

      {!card.faceDown && (card.name || (ownerPlayerName && (card.annotation || ownerPlayerName))) && (
        <div className="card-slot__top">
          {card.name && <div className="card-slot__name">{card.name}</div>}
          {ownerPlayerName && (
            // Source the owner label from card.annotation when the server
            // has populated it (Servatrice writes the owning player's name
            // there for enemy-battlefield cards). Falls back to the resolved
            // player username when annotation is empty.
            <div className="card-slot__owner">
              {card.annotation || ownerPlayerName}
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
