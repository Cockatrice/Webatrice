import type { HTMLAttributes, MouseEvent, PointerEvent } from 'react';
import { ZoneName } from '@cockatrice/sockatrice';

import { CARD_CORNER_RADIUS } from '../SeatCard/cardSize';
import Card from '../SeatCard/SeatCard';
import { GAME_FOCUS_RING } from '../focusRing';
import { SELECTED_RING } from '../seatColors/seatColors';
import type { PlayerCardViewModel } from '../PlayerBoard/playerBoard.types';

export interface HandCardTileProps {
  card: PlayerCardViewModel;
  ownerId: number;
  scryfallId: string | undefined;
  pt: string | undefined;
  dragging: boolean;
  selected: boolean;
  focusProps: HTMLAttributes<HTMLElement>;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
  onDoubleClick: (e: MouseEvent<HTMLElement>) => void;
}

export default function HandCardTile({
  card,
  ownerId,
  scryfallId,
  pt,
  dragging,
  selected,
  focusProps,
  onPointerDown,
  onContextMenu,
  onDoubleClick,
}: HandCardTileProps) {
  return (
    <div
      {...focusProps}
      className={GAME_FOCUS_RING}
      data-card
      data-zone="hand"
      data-card-id={card.id}
      data-selected={selected || undefined}
      data-card-owner={ownerId}
      data-card-zone={ZoneName.HAND}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        touchAction: 'none',
        cursor: 'grab',
        opacity: dragging ? 0 : 1,
        boxShadow: selected ? SELECTED_RING : undefined,
        borderRadius: CARD_CORNER_RADIUS,
      }}
    >
      <Card name={card.name} scryfallId={scryfallId} pt={pt} />
    </div>
  );
}
