import { memo } from 'react';

import { Enriched } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import CardSlot from '../CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { useGameInteraction } from '../GameInteractionContext';
import { useCanActFor, useCardVisualState } from '../CardVisualStateContext';
import { useGameIdRequired } from '../GameIdContext';
import { useHandZone } from './useHandZone';

import './HandZone.css';

export interface HandZoneProps {
  playerId: number;
  onHandContextMenu?: (event: React.MouseEvent) => void;
}

function HandZone({
  playerId,
  onHandContextMenu,
}: HandZoneProps) {
  const gameId = useGameIdRequired();
  const { onCardHover, onCardClick, onCardContextMenu, onCardDoubleClick, onCardFocus, onCardBlur } = useGameInteraction();
  const { arrowSourceKey, arrowTargetKey, selectedCardKeys } = useCardVisualState();
  const canAct = useCanActFor()(playerId);
  const { cards, setNodeRef, isOver, handleZoneContextMenu } = useHandZone({
    gameId,
    playerId,
    canAct,
    onZoneContextMenu: onHandContextMenu,
  });

  return (
    <div
      ref={setNodeRef}
      className={cx('hand-zone', { 'hand-zone--drop-over': isOver })}
      data-testid="hand-zone"
      onContextMenu={handleZoneContextMenu}
    >
      <div className="hand-zone__cards scrollable" data-zone-box-select="">
        {cards.map((card, idx) => {
          const key = makeCardKey(playerId, Enriched.ZoneName.HAND, card.id);
          return (
            <CardSlot
              key={card.id}
              card={card}
              draggable={canAct}
              ownerPlayerId={playerId}
              zone={Enriched.ZoneName.HAND}
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

// Memoized so board mutations don't re-render the hand; it re-renders only when its own
// hand-zone selection changes (getCards(HAND) ref is stable except on hand mutations).
export default memo(HandZone);
