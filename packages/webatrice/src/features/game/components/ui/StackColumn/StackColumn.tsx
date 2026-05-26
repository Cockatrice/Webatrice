import { useDroppable } from '@dnd-kit/core';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { Enriched } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import CardSlot from '../CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { useGameInteraction } from '../GameInteractionContext';

import './StackColumn.css';

export interface StackColumnProps {
  gameId: number;
  playerId: number;
  mirrored?: boolean;
  canAct?: boolean;
  arrowSourceKey?: string | null;
}

function StackColumn({
  gameId,
  playerId,
  mirrored = false,
  canAct = false,
  arrowSourceKey = null,
}: StackColumnProps) {
  const { onCardHover, onCardClick, onCardContextMenu, onCardDoubleClick } = useGameInteraction();
  const zone = useAppSelector((state) =>
    games.Selectors.getZone(state, gameId, playerId, Enriched.ZoneName.STACK),
  );
  const cards = zone ? zone.order.map((id) => zone.byId[id]).filter(Boolean) : [];

  const { setNodeRef, isOver } = useDroppable({
    id: `stack-${playerId}`,
    data: { targetPlayerId: playerId, targetZone: Enriched.ZoneName.STACK },
    disabled: !canAct,
  });

  return (
    <div
      ref={setNodeRef}
      className={cx('stack-column', {
        'stack-column--mirrored': mirrored,
        'stack-column--drop-over': isOver,
      })}
      data-testid={`stack-column-${playerId}`}
    >
      <div className="stack-column__cards" data-testid={`stack-column-cards-${playerId}`}>
        {cards.map((card) => {
          const key = makeCardKey(playerId, Enriched.ZoneName.STACK, card.id);
          return (
            <CardSlot
              key={card.id}
              card={card}
              draggable={canAct}
              ownerPlayerId={playerId}
              zone={Enriched.ZoneName.STACK}
              isArrowSource={arrowSourceKey === key}
              onMouseEnter={onCardHover}
              onClick={onCardClick}
              onContextMenu={onCardContextMenu}
              onDoubleClick={onCardDoubleClick}
            />
          );
        })}
      </div>
    </div>
  );
}

export default StackColumn;
