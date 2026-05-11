import { App, Data } from '@app/types';
import type { AttachedChild } from '@app/store';

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
  parent: Data.ServerInfo_Card;
  ownerPlayerId: number;
  attachments: AttachedChild[];
  draggable: boolean;
  arrowSourceKey: string | null;
  onCardHover?: (card: Data.ServerInfo_Card) => void;
  onCardClick?: (playerId: number, zone: string, card: Data.ServerInfo_Card) => void;
  onCardContextMenu?: (card: Data.ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (card: Data.ServerInfo_Card) => void;
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
  const parentKey = makeCardKey(ownerPlayerId, App.ZoneName.TABLE, parent.id);

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
          zone={App.ZoneName.TABLE}
          isArrowSource={arrowSourceKey === parentKey}
          onMouseEnter={onCardHover}
          onClick={(c) => onCardClick?.(ownerPlayerId, App.ZoneName.TABLE, c)}
          onContextMenu={onCardContextMenu}
          onDoubleClick={onCardDoubleClick}
        />
      </div>
      {attachments.map((entry, i) => {
        const { card: child, ownerPlayerId: childOwnerId } = entry;
        const childKey = makeCardKey(childOwnerId, App.ZoneName.TABLE, child.id);
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
              zone={App.ZoneName.TABLE}
              isArrowSource={arrowSourceKey === childKey}
              onMouseEnter={onCardHover}
              onClick={(c) => onCardClick?.(childOwnerId, App.ZoneName.TABLE, c)}
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
