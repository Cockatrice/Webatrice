import { memo } from 'react';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { games } from '@cockatrice/datatrice';

import AttachmentStack from './AttachmentStack';
import {
  ATTACH_PARENT_OFFSET_Y_PX,
  CARD_HEIGHT_PX,
  CARD_WIDTH_PX,
  STACKED_CARD_OFFSET_X_PX,
  STACKED_CARD_OFFSET_Y_PX,
  attachmentStackFactor,
  roundPercent,
} from './gridMath';

import './BattlefieldStackColumn.css';

const EMPTY_ATTACHMENTS: games.AttachedChild[] = [];

// Footprint of a stack column in nominal pixels.
// See .github/instructions/webatrice-game.instructions.md#attachment-stack for the N>0 parent shift rule.
function computeStackFootprint(
  cards: ServerInfo_Card[],
  attachmentsByParent: ReadonlyMap<number, games.AttachedChild[]>,
): { widthPx: number; heightPx: number } {
  let maxRight = CARD_WIDTH_PX;
  let maxBottom = CARD_HEIGHT_PX;
  cards.forEach((card, subPos) => {
    const attachCount = attachmentsByParent.get(card.id)?.length ?? 0;
    const cardWidth = CARD_WIDTH_PX * attachmentStackFactor(attachCount);
    const leftOffset = subPos * STACKED_CARD_OFFSET_X_PX;
    maxRight = Math.max(maxRight, leftOffset + cardWidth);

    const stackTop = subPos * STACKED_CARD_OFFSET_Y_PX;
    const parentTop = stackTop + (attachCount > 0 ? ATTACH_PARENT_OFFSET_Y_PX : 0);
    maxBottom = Math.max(maxBottom, parentTop + CARD_HEIGHT_PX);
  });
  return { widthPx: roundPercent(maxRight), heightPx: roundPercent(maxBottom) };
}

function slotWidthFor(
  card: ServerInfo_Card,
  attachmentsByParent: ReadonlyMap<number, games.AttachedChild[]>,
): number {
  const attachCount = attachmentsByParent.get(card.id)?.length ?? 0;
  return CARD_WIDTH_PX * attachmentStackFactor(attachCount);
}

export interface BattlefieldStackColumnProps {
  cards: ServerInfo_Card[]; // 1..MAX_SUBPOS cards, sorted by sub-position
  attachmentsByParent: ReadonlyMap<number, games.AttachedChild[]>;
  draggable: boolean;
  ownerPlayerId: number;
  arrowSourceKey: string | null;
  onCardHover?: (card: ServerInfo_Card) => void;
  onCardClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardContextMenu?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (playerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
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
  const slotHeightPct = roundPercent((CARD_HEIGHT_PX * 100) / heightPx);

  return (
    <div
      className="battlefield-stack-column"
      data-testid="battlefield-stack-column"
      style={{ aspectRatio: `${widthPx} / ${heightPx}` }}
    >
      {cards.map((card, subPos) => {
        const slotWidth = slotWidthFor(card, attachmentsByParent);
        const leftPct = roundPercent((subPos * STACKED_CARD_OFFSET_X_PX * 100) / widthPx);
        const widthPct = roundPercent((slotWidth * 100) / widthPx);
        const topPct = roundPercent((subPos * STACKED_CARD_OFFSET_Y_PX * 100) / heightPx);
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
              // Later subPos paints on top (desktop paint order).
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

export default memo(BattlefieldStackColumn);
