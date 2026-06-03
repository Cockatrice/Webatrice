import { memo, useCallback } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { cx } from '@app/utils';

import CardSlotContent from './CardSlotContent';
import { useCardSlot } from './useCardSlot';

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
