// Port of cockatrice/src/game/zones/table_zone.cpp. See .github/instructions/webatrice-game.instructions.md#battlefield-grid.
//
// Grid encoding: a server-wire X coordinate ("gridX") packs a stack column and a sub-position
// within that column as `gridX = col * MAX_SUBPOS + subPos`. Y is the row index in [0, ROW_COUNT).
// Helpers below are the single source of truth for translating between gridX and (col, subPos),
// computing stack/attachment footprints, and mapping pointer pixels onto the grid.

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

/** Server wire X coordinate on the battlefield grid (col * MAX_SUBPOS + subPos). */
export type GridCoord = number;

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

/** Clamps a row index into [0, ROW_COUNT). */
export function clampRow(y: number): number {
  if (y < 0) {
    return 0;
  }
  if (y >= ROW_COUNT) {
    return ROW_COUNT - 1;
  }
  return y;
}

/** Stack column index of a gridX (the floor-divide half of `gridX = col * MAX_SUBPOS + subPos`). */
export function getStackColumn(gridX: GridCoord): number {
  return Math.floor(gridX / MAX_SUBPOS);
}

/** Sub-position within a stack column (the modulo half of `gridX = col * MAX_SUBPOS + subPos`). */
export function getSubPosition(gridX: GridCoord): number {
  return ((gridX % MAX_SUBPOS) + MAX_SUBPOS) % MAX_SUBPOS;
}

/** Packs (col, subPos) into a gridX. Pass subPos = 0 for "base of stack". */
export function gridXFromColumn(col: number, subPos = 0): GridCoord {
  return col * MAX_SUBPOS + subPos;
}

/**
 * Pixel width of a stack column holding `cardCount` cards. Width is capped at MAX_SUBPOS
 * cards even when cardCount is larger; overflow is the caller's problem (a 4th card spills
 * to the next column).
 */
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

/** Groups cards by stack column (`getStackColumn(card.x)`) → count. */
export function stackCountsForRow(cards: ServerInfo_Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const col = getStackColumn(card.x ?? 0);
    counts.set(col, (counts.get(col) ?? 0) + 1);
  }
  return counts;
}

/**
 * First empty stack column on `wireY` — i.e. one past the rightmost existing column.
 * Returns 0 when the row is empty. Caller is responsible for passing only cards from
 * the relevant zone (attachments etc. should be filtered upstream as appropriate).
 */
export function nextAvailableColumn(cards: ServerInfo_Card[], wireY: number): number {
  let nextCol = 0;
  for (const card of cards) {
    if (clampRow(card.y ?? 0) !== wireY) {
      continue;
    }
    const col = getStackColumn(card.x ?? 0);
    if (col + 1 > nextCol) {
      nextCol = col + 1;
    }
  }
  return nextCol;
}

/**
 * Translates a pointer X (relative to a row's content edge) into a gridX by walking stack
 * columns left-to-right, adding `PADDING_X / 2` to snap to the nearer column (matches
 * desktop table_zone.cpp line 340).
 */
export function mapToGridX(
  pointerXInRow: number,
  stackCounts: Map<number, number>,
  cardWidth: number = CARD_WIDTH_PX,
  offsetX: number = STACKED_CARD_OFFSET_X_PX,
  paddingX: number = PADDING_X_PX,
): GridCoord {
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
  return gridXFromColumn(stackCol, subPos);
}

/**
 * Resolves a target gridX to the nearest unoccupied sub-position within its stack column.
 * Returns null when all MAX_SUBPOS slots are taken — callers must skip the move.
 */
export function closestGridPoint(
  gridX: GridCoord,
  occupiedXs: ReadonlySet<number>,
): GridCoord | null {
  const base = gridXFromColumn(getStackColumn(gridX));
  for (let i = 0; i < MAX_SUBPOS; i++) {
    if (!occupiedXs.has(base + i)) {
      return base + i;
    }
  }
  return null;
}

/** Inverts a row index for opponent-perspective rendering (front-of-board stays nearest the viewer). */
export function applyInvertY(gridY: number, isInverted: boolean): number {
  const clamped = clampRow(gridY);
  return isInverted ? ROW_COUNT - 1 - clamped : clamped;
}

/** Horizontal scale factor for a parent slot that fans `attachmentCount` children to its left. */
export function attachmentStackFactor(attachmentCount: number): number {
  return 1 + attachmentCount * ATTACH_OFFSET_FRACTION;
}

export interface AttachmentSlotLayout {
  leftPct: number;
  topPct: number;
  widthPct: number;
  zIndex: number;
}

/**
 * Position for one slot in an attachment stack of size `attachmentCount`.
 * `index === -1` is the parent slot; `0..attachmentCount-1` are children fanning left behind it.
 */
export function attachmentSlotLayout(attachmentCount: number, index: number): AttachmentSlotLayout {
  const N = attachmentCount;
  const stackFactor = attachmentStackFactor(N);
  const widthPct = roundPercent(100 / stackFactor);
  if (index === -1) {
    return {
      leftPct: N > 0 ? roundPercent((N * ATTACH_OFFSET_FRACTION * 100) / stackFactor) : 0,
      topPct: N > 0 ? roundPercent((ATTACH_PARENT_OFFSET_Y_PX * 100) / CARD_HEIGHT_PX) : 0,
      widthPct,
      zIndex: N + 1,
    };
  }
  return {
    leftPct: roundPercent(((N - 1 - index) * ATTACH_OFFSET_FRACTION * 100) / stackFactor),
    topPct: roundPercent((ATTACH_CHILD_OFFSET_Y_PX * 100) / CARD_HEIGHT_PX),
    widthPct,
    zIndex: N - index,
  };
}

/**
 * Effective card dimensions when the row is rendered at a different height than CARD_HEIGHT_PX
 * (cards use CSS aspect-ratio, so width scales with the rendered lane height). Falls back to
 * the nominal width when laneHeight is non-positive.
 */
export function effectiveCardDimensions(laneHeightPx: number): { width: number; offsetX: number } {
  if (laneHeightPx <= 0) {
    return { width: CARD_WIDTH_PX, offsetX: STACKED_CARD_OFFSET_X_PX };
  }
  const width = (laneHeightPx * CARD_WIDTH_PX) / CARD_HEIGHT_PX;
  const offsetX = (width * STACKED_CARD_OFFSET_X_PX) / CARD_WIDTH_PX;
  return { width, offsetX };
}

/** Rounds a CSS-percentage value to 2 decimal places (sub-pixel jitter trim). */
export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
