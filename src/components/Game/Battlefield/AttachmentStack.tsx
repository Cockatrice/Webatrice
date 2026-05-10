import { App, Data } from '@app/types';

import CardSlot from '../CardSlot/CardSlot';
import { makeCardKey } from '../CardRegistry/CardRegistryContext';
import {
  ATTACH_CHILD_OFFSET_Y_PX,
  ATTACH_OFFSET_FRACTION,
  ATTACH_PARENT_OFFSET_Y_PX,
  CARD_HEIGHT_PX,
} from './gridMath';

import './AttachmentStack.css';

export interface AttachmentStackProps {
  parent: Data.ServerInfo_Card;
  attachments: Data.ServerInfo_Card[];
  draggable: boolean;
  ownerPlayerId: number;
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

  // Stack footprint in units of one card width: 1 + N × FRACTION. Each card
  // shares width = 1 / stackFactor of the stack. Layout matches desktop's
  // table_zone.cpp:153-185: parent shifts right by N×OFFSET; attached card j
  // sits at parent_x − j×OFFSET. So the parent ends up rightmost (highest z),
  // first-attached child sits just left of parent (next-highest z), and the
  // most-recently-attached child is leftmost and underneath.
  const N = attachments.length;
  const stackFactor = 1 + N * ATTACH_OFFSET_FRACTION;
  const cardWidthPct = round(100 / stackFactor);

  // Parent Y offset only when N > 0, mirroring desktop's
  // `if (numberAttachedCards) actualY += 15`. Without this guard, every
  // standalone card would render shifted down.
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
          // Parent is always on top of its own attachments. When N=0 the
          // z-index doesn't matter (no siblings inside the stack), but we
          // still set it so the parent layers cleanly above any neighbor
          // stack column visualizations during drag.
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
      {attachments.map((child, i) => {
        const childKey = makeCardKey(ownerPlayerId, App.ZoneName.TABLE, child.id);
        // Child i sits (N - 1 - i) slots from the left → first-attached
        // (i=0) ends up just left of parent with the highest child z, matching
        // desktop's "j=1 = closest to parent = highest screen X = highest z".
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
              ownerPlayerId={ownerPlayerId}
              zone={App.ZoneName.TABLE}
              isArrowSource={arrowSourceKey === childKey}
              onMouseEnter={onCardHover}
              onClick={(c) => onCardClick?.(ownerPlayerId, App.ZoneName.TABLE, c)}
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
