import { Enriched } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import CardSlot from '../CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { useGameInteraction } from '../GameInteractionContext';
import { useHandZone } from './useHandZone';

import './HandZone.css';

export interface HandZoneProps {
  gameId: number;
  playerId: number;
  canAct?: boolean;
  arrowSourceKey?: string | null;
  arrowTargetKey?: string | null;
  selectedCardKey?: string | null;
  onHandContextMenu?: (event: React.MouseEvent) => void;
}

function HandZone({
  gameId,
  playerId,
  canAct = false,
  arrowSourceKey = null,
  arrowTargetKey = null,
  selectedCardKey = null,
  onHandContextMenu,
}: HandZoneProps) {
  const { onCardHover, onCardClick, onCardContextMenu, onCardDoubleClick, onCardFocus, onCardBlur } = useGameInteraction();
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
      <div className="hand-zone__cards scrollable">
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
              isSelected={selectedCardKey === key}
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

export default HandZone;
