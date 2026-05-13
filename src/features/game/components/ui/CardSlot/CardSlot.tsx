import { memo } from 'react';

import { ServerInfo_Card } from 'sockatrice/generated';
import { ZoneName } from 'datatrice';
import { cx } from '@app/utils';

import { counterColorForId } from './counterColors';
import { useCardSlot } from './useCardSlot';

import './CardSlot.css';

export interface CardSlotProps {
  card: ServerInfo_Card;
  draggable?: boolean;
  isArrowSource?: boolean;
  ownerPlayerId?: number;
  zone?: string;
  onClick?: (card: ServerInfo_Card) => void;
  onDoubleClick?: (card: ServerInfo_Card) => void;
  onContextMenu?: (card: ServerInfo_Card, event: React.MouseEvent) => void;
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

      {!card.faceDown && (card.name || (zone === ZoneName.TABLE && card.annotation)) && (
        <div className="card-slot__top">
          {card.name && <div className="card-slot__name">{card.name}</div>}
          {zone === ZoneName.TABLE && card.annotation && (
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
