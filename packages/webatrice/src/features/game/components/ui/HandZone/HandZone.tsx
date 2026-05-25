import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { cx } from '@app/utils';

import CardSlot from '../CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { useHandZone } from './useHandZone';

import './HandZone.css';

export interface HandZoneProps {
  gameId: number;
  playerId: number;
  canAct?: boolean;
  arrowSourceKey?: string | null;
  onCardHover?: (card: ServerInfo_Card) => void;
  onCardClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardContextMenu?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onZoneContextMenu?: (event: React.MouseEvent) => void;
}

function HandZone({
  gameId,
  playerId,
  canAct = false,
  arrowSourceKey = null,
  onCardHover,
  onCardClick,
  onCardContextMenu,
  onCardDoubleClick,
  onZoneContextMenu,
}: HandZoneProps) {
  const { cards, setNodeRef, isOver, handleZoneContextMenu } = useHandZone({
    gameId,
    playerId,
    canAct,
    onZoneContextMenu,
  });

  return (
    <div
      ref={setNodeRef}
      className={cx('hand-zone', { 'hand-zone--drop-over': isOver })}
      data-testid="hand-zone"
      onContextMenu={handleZoneContextMenu}
    >
      <div className="hand-zone__cards">
        {cards.map((card) => {
          const key = makeCardKey(playerId, Enriched.ZoneName.HAND, card.id);
          return (
            <CardSlot
              key={card.id}
              card={card}
              draggable={canAct}
              ownerPlayerId={playerId}
              zone={Enriched.ZoneName.HAND}
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

export default HandZone;
