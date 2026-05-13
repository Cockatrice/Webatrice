import { ServerInfo_Card } from 'sockatrice/generated';
import { ZoneName } from 'datatrice';
import { games } from 'datatrice';

import CardSlot from '../../ui/CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import {
  ATTACH_CHILD_OFFSET_Y_PX,
  ATTACH_OFFSET_FRACTION,
  ATTACH_PARENT_OFFSET_Y_PX,
  CARD_HEIGHT_PX,
} from './gridMath';

import './AttachmentStack.css';

export interface AttachmentStackProps {
  parent: ServerInfo_Card;
  ownerPlayerId: number;
  attachments: games.AttachedChild[];
  draggable: boolean;
  arrowSourceKey: string | null;
  onCardHover?: (card: ServerInfo_Card) => void;
  onCardClick?: (playerId: number, zone: string, card: ServerInfo_Card) => void;
  onCardContextMenu?: (card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (card: ServerInfo_Card) => void;
}

const round = (n: number): number => Math.round(n * 100) / 100;

function AttachmentStack({
  parent,
  attachments,
  draggable,
  ownerPlayerId,
  arrowSourceKey,
  onCardHover,
  onCardClick,
  onCardContextMenu,
  onCardDoubleClick,
}: AttachmentStackProps) {
  const parentKey = makeCardKey(ownerPlayerId, ZoneName.TABLE, parent.id);

  const N = attachments.length;
  const stackFactor = 1 + N * ATTACH_OFFSET_FRACTION;
  const cardWidthPct = round(100 / stackFactor);

  const parentLeftPct = N > 0 ? round((N * ATTACH_OFFSET_FRACTION * 100) / stackFactor) : 0;
  const parentTopPct =
    N > 0 ? round((ATTACH_PARENT_OFFSET_Y_PX * 100) / CARD_HEIGHT_PX) : 0;
  const childTopPct = round((ATTACH_CHILD_OFFSET_Y_PX * 100) / CARD_HEIGHT_PX);

  return (
    <div className="attachment-stack">
      <div
        className="attachment-stack__parent"
        style={{
          left: `${parentLeftPct}%`,
          top: `${parentTopPct}%`,
          width: `${cardWidthPct}%`,
          zIndex: N + 1,
        }}
      >
        <CardSlot
          card={parent}
          draggable={draggable}
          ownerPlayerId={ownerPlayerId}
          zone={ZoneName.TABLE}
          isArrowSource={arrowSourceKey === parentKey}
          onMouseEnter={onCardHover}
          onClick={(c) => onCardClick?.(ownerPlayerId, ZoneName.TABLE, c)}
          onContextMenu={onCardContextMenu}
          onDoubleClick={onCardDoubleClick}
        />
      </div>
      {attachments.map((entry, i) => {
        const { card: child, ownerPlayerId: childOwnerId } = entry;
        const childKey = makeCardKey(childOwnerId, ZoneName.TABLE, child.id);
        const leftPct = round(((N - 1 - i) * ATTACH_OFFSET_FRACTION * 100) / stackFactor);
        return (
          <div
            key={child.id}
            className="attachment-stack__child"
            style={{
              left: `${leftPct}%`,
              top: `${childTopPct}%`,
              width: `${cardWidthPct}%`,
              zIndex: N - i,
            }}
          >
            <CardSlot
              card={child}
              draggable={draggable}
              ownerPlayerId={childOwnerId}
              zone={ZoneName.TABLE}
              isArrowSource={arrowSourceKey === childKey}
              onMouseEnter={onCardHover}
              onClick={(c) => onCardClick?.(childOwnerId, ZoneName.TABLE, c)}
              onContextMenu={onCardContextMenu}
              onDoubleClick={onCardDoubleClick}
            />
          </div>
        );
      })}
    </div>
  );
}

export default AttachmentStack;
