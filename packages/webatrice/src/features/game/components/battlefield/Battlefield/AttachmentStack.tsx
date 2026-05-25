import { memo } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched } from '@cockatrice/datatrice';
import { games } from '@cockatrice/datatrice';

import CardSlot from '../../ui/CardSlot/CardSlot';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import {
  ATTACH_CHILD_OFFSET_Y_PX,
  ATTACH_OFFSET_FRACTION,
  ATTACH_PARENT_OFFSET_Y_PX,
  CARD_HEIGHT_PX,
  attachmentStackFactor,
  roundPercent,
} from './gridMath';

import './AttachmentStack.css';

export interface AttachmentStackProps {
  parent: ServerInfo_Card;
  ownerPlayerId: number;
  attachments: games.AttachedChild[];
  draggable: boolean;
  arrowSourceKey: string | null;
  onCardHover?: (card: ServerInfo_Card) => void;
  onCardClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardContextMenu?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
}

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
  const parentKey = makeCardKey(ownerPlayerId, Enriched.ZoneName.TABLE, parent.id);

  const N = attachments.length;
  const stackFactor = attachmentStackFactor(N);
  const cardWidthPct = roundPercent(100 / stackFactor);

  const parentLeftPct = N > 0 ? roundPercent((N * ATTACH_OFFSET_FRACTION * 100) / stackFactor) : 0;
  const parentTopPct =
    N > 0 ? roundPercent((ATTACH_PARENT_OFFSET_Y_PX * 100) / CARD_HEIGHT_PX) : 0;
  const childTopPct = roundPercent((ATTACH_CHILD_OFFSET_Y_PX * 100) / CARD_HEIGHT_PX);

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
          zone={Enriched.ZoneName.TABLE}
          isArrowSource={arrowSourceKey === parentKey}
          onMouseEnter={onCardHover}
          onClick={onCardClick}
          onContextMenu={onCardContextMenu}
          onDoubleClick={onCardDoubleClick}
        />
      </div>
      {attachments.map((entry, i) => {
        const { card: child, ownerPlayerId: childOwnerId } = entry;
        const childKey = makeCardKey(childOwnerId, Enriched.ZoneName.TABLE, child.id);
        const leftPct = roundPercent(((N - 1 - i) * ATTACH_OFFSET_FRACTION * 100) / stackFactor);
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
              zone={Enriched.ZoneName.TABLE}
              isArrowSource={arrowSourceKey === childKey}
              onMouseEnter={onCardHover}
              onClick={onCardClick}
              onContextMenu={onCardContextMenu}
              onDoubleClick={onCardDoubleClick}
            />
          </div>
        );
      })}
    </div>
  );
}

export default memo(AttachmentStack);
