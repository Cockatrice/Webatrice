import { Data } from '@app/types';
import type { AttachedChild } from '@app/store';

import AttachmentStack from './AttachmentStack';
import {
  ATTACH_OFFSET_FRACTION,
  ATTACH_PARENT_OFFSET_Y_PX,
  CARD_HEIGHT_PX,
  CARD_WIDTH_PX,
  STACKED_CARD_OFFSET_X_PX,
  STACKED_CARD_OFFSET_Y_PX,
} from './gridMath';

import './BattlefieldStackColumn.css';

const EMPTY_ATTACHMENTS: AttachedChild[] = [];

const round = (n: number): number => Math.round(n * 100) / 100;

// Footprint of a stack column in nominal pixels (146×204 reference card).
// - Width: rightmost extent across all cards in the stack, including each
//   card's attachment fan (parent + N×fraction). Prevents an attachment on
//   subPos 0 from overlapping the next stack.
// - Height: bottommost extent. Subpos cards stair-step down by
//   STACKED_CARD_OFFSET_Y_PX, and a card *with* attachments shifts its parent
//   further down by ATTACH_PARENT_OFFSET_Y_PX (the fan's Y offset is only
//   applied when N > 0, matching desktop's `if (numberAttachedCards)` guard).
// The stack column scales with lane height via aspect-ratio; per-slot
// left/top/width/height are expressed as percentages of this footprint so
// positions stay proportional at any zoom level.
function computeStackFootprint(
  cards: Data.ServerInfo_Card[],
  attachmentsByParent: ReadonlyMap<number, AttachedChild[]>,
): { widthPx: number; heightPx: number } {
  let maxRight = CARD_WIDTH_PX;
  let maxBottom = CARD_HEIGHT_PX;
  cards.forEach((card, subPos) => {
    const attachCount = attachmentsByParent.get(card.id)?.length ?? 0;
    const cardWidth = CARD_WIDTH_PX * (1 + attachCount * ATTACH_OFFSET_FRACTION);
    const leftOffset = subPos * STACKED_CARD_OFFSET_X_PX;
    maxRight = Math.max(maxRight, leftOffset + cardWidth);

    const stackTop = subPos * STACKED_CARD_OFFSET_Y_PX;
    const parentTop = stackTop + (attachCount > 0 ? ATTACH_PARENT_OFFSET_Y_PX : 0);
    maxBottom = Math.max(maxBottom, parentTop + CARD_HEIGHT_PX);
  });
  return { widthPx: round(maxRight), heightPx: round(maxBottom) };
}

function slotWidthFor(
  card: Data.ServerInfo_Card,
  attachmentsByParent: ReadonlyMap<number, AttachedChild[]>,
): number {
  const attachCount = attachmentsByParent.get(card.id)?.length ?? 0;
  return CARD_WIDTH_PX * (1 + attachCount * ATTACH_OFFSET_FRACTION);
}

export interface BattlefieldStackColumnProps {
  cards: Data.ServerInfo_Card[]; // 1..MAX_SUBPOS cards, sorted by sub-position
  attachmentsByParent: ReadonlyMap<number, AttachedChild[]>;
  draggable: boolean;
  ownerPlayerId: number;
  arrowSourceKey: string | null;
  onCardHover?: (card: Data.ServerInfo_Card) => void;
  onCardClick?: (playerId: number, zone: string, card: Data.ServerInfo_Card) => void;
  onCardContextMenu?: (card: Data.ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (card: Data.ServerInfo_Card) => void;
}

function BattlefieldStackColumn({
  cards,
  attachmentsByParent,
  draggable,
  ownerPlayerId,
  arrowSourceKey,
  onCardHover,
  onCardClick,
  onCardContextMenu,
  onCardDoubleClick,
}: BattlefieldStackColumnProps) {
  const { widthPx, heightPx } = computeStackFootprint(cards, attachmentsByParent);
  const slotHeightPct = round((CARD_HEIGHT_PX * 100) / heightPx);

  return (
    <div
      className="battlefield-stack-column"
      data-testid="battlefield-stack-column"
      style={{ aspectRatio: `${widthPx} / ${heightPx}` }}
    >
      {cards.map((card, subPos) => {
        const slotWidth = slotWidthFor(card, attachmentsByParent);
        const leftPct = round((subPos * STACKED_CARD_OFFSET_X_PX * 100) / widthPx);
        const widthPct = round((slotWidth * 100) / widthPx);
        const topPct = round((subPos * STACKED_CARD_OFFSET_Y_PX * 100) / heightPx);
        return (
          <div
            key={card.id}
            className="battlefield-stack-column__slot"
            data-sub-position={subPos}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${slotHeightPct}%`,
              // Later sub-positions render on top of earlier ones, matching
              // desktop's paint order where cards added later overlay neighbors.
              zIndex: subPos + 1,
            }}
          >
            <AttachmentStack
              parent={card}
              attachments={attachmentsByParent.get(card.id) ?? EMPTY_ATTACHMENTS}
              draggable={draggable}
              ownerPlayerId={ownerPlayerId}
              arrowSourceKey={arrowSourceKey}
              onCardHover={onCardHover}
              onCardClick={onCardClick}
              onCardContextMenu={onCardContextMenu}
              onCardDoubleClick={onCardDoubleClick}
            />
          </div>
        );
      })}
    </div>
  );
}

export default BattlefieldStackColumn;
