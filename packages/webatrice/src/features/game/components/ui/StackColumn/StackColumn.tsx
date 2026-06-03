import { ZoneName } from '@cockatrice/sockatrice';
import { useDroppable } from '@dnd-kit/core';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { cx } from '@app/utils';

import CardSlot from '../CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { useGameInteraction } from '../GameInteractionContext';
import { useCanActFor, useCardVisualState } from '../CardVisualStateContext';
import { useGameIdRequired } from '../GameIdContext';
import { useBoardCell } from '../BoardCellContext';

import './StackColumn.css';

function StackColumn() {
  const { playerId, mirrored } = useBoardCell();
  const gameId = useGameIdRequired();
  const { onCardHover, onCardClick, onCardContextMenu, onCardDoubleClick, onCardFocus, onCardBlur } = useGameInteraction();
  const { arrowSourceKey, arrowTargetKey, selectedCardKeys } = useCardVisualState();
  const canAct = useCanActFor()(playerId);
  const zone = useAppSelector((state) =>
    games.Selectors.getZone(state, gameId, playerId, ZoneName.STACK),
  );
  const cards = zone ? zone.order.map((id) => zone.byId[id]).filter(Boolean) : [];

  const { setNodeRef, isOver } = useDroppable({
    id: `stack-${playerId}`,
    data: { targetPlayerId: playerId, targetZone: ZoneName.STACK },
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
      <div className="stack-column__cards scrollable" data-testid={`stack-column-cards-${playerId}`} data-zone-box-select="">
        {cards.map((card, idx) => {
          const key = makeCardKey(playerId, ZoneName.STACK, card.id);
          return (
            <CardSlot
              key={card.id}
              card={card}
              draggable={canAct}
              ownerPlayerId={playerId}
              zone={ZoneName.STACK}
              dropIndex={idx}
              isArrowSource={arrowSourceKey === key}
              isArrowTarget={arrowTargetKey === key}
              isSelected={selectedCardKeys.has(key)}
              onMouseEnter={onCardHover}
              onFocus={onCardFocus}
              onBlur={onCardBlur}
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
