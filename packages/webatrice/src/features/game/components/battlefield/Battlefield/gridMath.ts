// Port of cockatrice/src/game/zones/table_zone.cpp. See .github/instructions/webatrice-game.instructions.md#battlefield-grid.

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
export const CARD_WIDTH_PX = 146;
export const CARD_HEIGHT_PX = 204;
export const STACKED_CARD_OFFSET_X_PX = 49;
export const PADDING_X_PX = 16;
export const MARGIN_LEFT_PX = 8;

export const ROW_COUNT = 3;
export const MAX_SUBPOS = 3;

// Web tuned to 12px (6% of card height) vs desktop's 10% — readable at typical zoom while staying within the row's vertical padding budget.
export const STACKED_CARD_OFFSET_Y_PX = 12;

export const ATTACH_PARENT_OFFSET_Y_PX = 14;
export const ATTACH_CHILD_OFFSET_Y_PX = 6;

export const ATTACH_OFFSET_FRACTION = 1 / 3;

export function clampRow(y: number): number {
  if (y < 0) {
    return 0;
  }
  if (y >= ROW_COUNT) {
    return ROW_COUNT - 1;
  }
  return y;
}

export function stackColumnWidth(
  cardCount: number,
  cardWidth: number = CARD_WIDTH_PX,
  offsetX: number = STACKED_CARD_OFFSET_X_PX,
): number {
  if (cardCount <= 1) {
    return cardWidth;
  }
  const extras = Math.min(cardCount - 1, MAX_SUBPOS - 1);
  return cardWidth + extras * offsetX;
}

export function stackCountsForRow(cards: ServerInfo_Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const col = Math.floor((card.x ?? 0) / MAX_SUBPOS);
    counts.set(col, (counts.get(col) ?? 0) + 1);
  }
  return counts;
}

export function mapToGridX(
  pointerXInRow: number,
  stackCounts: Map<number, number>,
  cardWidth: number = CARD_WIDTH_PX,
  offsetX: number = STACKED_CARD_OFFSET_X_PX,
  paddingX: number = PADDING_X_PX,
): number {
  const x = pointerXInRow + paddingX / 2;

  let xStack = 0;
  let xNextStack = 0;
  let nextStackCol = 0;
  while (xNextStack <= x) {
    xStack = xNextStack;
    const w = stackColumnWidth(stackCounts.get(nextStackCol) ?? 0, cardWidth, offsetX);
    xNextStack += w + paddingX;
    nextStackCol++;
  }
  const stackCol = Math.max(nextStackCol - 1, 0);
  const xDiff = Math.max(0, x - xStack);
  const subPos = Math.min(Math.floor(xDiff / offsetX), MAX_SUBPOS - 1);
  return stackCol * MAX_SUBPOS + subPos;
}

// Returns null when all MAX_SUBPOS slots in the target stack are taken — callers must skip the move.
export function closestGridPoint(
  gridX: number,
  occupiedXs: ReadonlySet<number>,
): number | null {
  const base = Math.floor(gridX / MAX_SUBPOS) * MAX_SUBPOS;
  for (let i = 0; i < MAX_SUBPOS; i++) {
    if (!occupiedXs.has(base + i)) {
      return base + i;
    }
  }
  return null;
}

export function applyInvertY(gridY: number, isInverted: boolean): number {
  const clamped = clampRow(gridY);
  return isInverted ? ROW_COUNT - 1 - clamped : clamped;
}
