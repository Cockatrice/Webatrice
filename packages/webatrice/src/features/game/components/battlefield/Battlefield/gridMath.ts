// Port of cockatrice/src/game/zones/table_zone.cpp. See .github/instructions/webatrice-game.instructions.md#battlefield-grid.
//
// Grid encoding: a server-wire X coordinate ("gridX") packs a stack column and a sub-position
// within that column as `gridX = col * MAX_SUBPOS + subPos`. Y is the row index in [0, ROW_COUNT).
// Helpers below are the single source of truth for translating between gridX and (col, subPos).
// The seat's pixel layout and drop snapping live in battlefieldLayout.ts.

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

/** Server wire X coordinate on the battlefield grid (col * MAX_SUBPOS + subPos). */
export type GridCoord = number;

export const ROW_COUNT = 3;
export const MAX_SUBPOS = 3;

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

/** Inverts a row index for opponent-perspective rendering (front-of-board stays nearest the viewer). */
export function applyInvertY(gridY: number, isInverted: boolean): number {
  const clamped = clampRow(gridY);
  return isInverted ? ROW_COUNT - 1 - clamped : clamped;
}

