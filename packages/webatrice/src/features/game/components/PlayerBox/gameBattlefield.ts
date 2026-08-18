/**
 * Battlefield grid + snap logic.
 *
 * The battlefield is a 3-row grid — this matches Cockatrice's desktop
 * client (`TABLEROWS = 3`) so wire y coordinates stay meaningful across
 * both clients:
 *   • row 0 (top of owner's board)    → lands
 *   • row 1                           → non-creature permanents
 *   • row 2 (bottom of owner's board) → creatures
 * Column count is dynamic: however many card-sized slots fit horizontally
 * in the container, with a fixed gap between them.
 *
 * Battlefields are per-player: each player has their own grid. A card can
 * live on any player's battlefield — its `battlefieldOwnerId` on the game
 * card names which one.
 *
 * All functions here are pure — no state, no side effects. UI and game-state
 * modules layer on top.
 */

/** Number of rows on every battlefield. Matches Cockatrice desktop's
 *  `TABLEROWS` constant so wire y coordinates round-trip identically. */
export const BATTLEFIELD_ROWS = 3;

/** Constant spacing between adjacent slots (px). Ported from Cockatrice
 *  desktop's `TableZone::PADDING_X` (table_zone.h:37) so a card + stack
 *  in webatrice occupies the same horizontal footprint the desktop
 *  client uses. */
export const BATTLEFIELD_GAP_PX = 35;

/** Diagonal offset (px) applied per additional card when multiple cards
 *  occupy the same slot — creates the "fan" stack look. Ported from
 *  `STACKED_CARD_OFFSET_X = CardDimensions::WIDTH / 3 = 24`; the base
 *  card is 72px so 24px is a ⅓-card horizontal shift per sub-slot. */
export const STACK_OFFSET_PX = 24;

/** Vertical component of the stack diagonal — ported from
 *  `STACKED_CARD_OFFSET_Y = PADDING_Y / 3 = 10`. */
export const STACK_OFFSET_Y_PX = 10;

/** Vertical spacing between adjacent rows. `TableZone::PADDING_Y`. */
export const BATTLEFIELD_ROW_PADDING_PX = 30;

/** Left / right / top scene margins. `TableZone::MARGIN_*`. */
export const BATTLEFIELD_MARGIN_LEFT_PX = 20;
export const BATTLEFIELD_MARGIN_RIGHT_PX = 15;
export const BATTLEFIELD_MARGIN_TOP_PX = 10;

/** Minimum column count to always reserve horizontal room for, matching
 *  Cockatrice's `TableZone::MIN_WIDTH = MARGIN_LEFT + 5 * CARD_WIDTH +
 *  MARGIN_RIGHT` — always shows at least 5 base-card-wide columns per
 *  row so an empty battlefield still reads as a play area. */
export const BATTLEFIELD_MIN_COLS = 5;

/** Number of sub-slots per visual column (Cockatrice's wire-x % 3). */
export const SUBSLOTS_PER_COLUMN = 3;

/** A single slot address on some battlefield (whose battlefield is tracked
 *  separately on the card itself). */
export type BattlefieldSlot = {
  row: number;
  col: number;
};

/** Battlefield grid dimensions computed from container size + card size. */
export type BattlefieldGrid = {
  cols: number;
  rows: number;
};

/**
 * How many card-sized slots (with the fixed gap between them) fit along
 * one axis given the container size. Always returns at least 1 so an
 * absurdly small battlefield still has one slot.
 */
export function slotsAlongAxis(
  containerPx: number,
  cardPx: number,
  gapPx = BATTLEFIELD_GAP_PX,
): number {
  if (containerPx <= 0 || cardPx <= 0) return 0;
  // Fit N cards + (N-1) gaps into containerPx.  Solve for N: containerPx = N*card + (N-1)*gap  →  N = (containerPx + gap) / (card + gap)
  return Math.max(1, Math.floor((containerPx + gapPx) / (cardPx + gapPx)));
}

/** Compute grid dimensions that fit in a container. Rows are always
 *  `BATTLEFIELD_ROWS` (3) to stay wire-compatible with Cockatrice; only
 *  the column count adapts to the container width. The height argument
 *  is retained for callers that still pass it but no longer influences
 *  the returned row count. */
export function fitBattlefieldGrid(
  containerWidthPx: number,
  _containerHeightPx: number,
  cardWidthPx: number,
  _cardHeightPx: number,
  gapPx = BATTLEFIELD_GAP_PX,
): BattlefieldGrid {
  return {
    cols: slotsAlongAxis(containerWidthPx, cardWidthPx, gapPx),
    rows: BATTLEFIELD_ROWS,
  };
}

/**
 * Snap fractional coordinates within a battlefield (0..1 in both axes) to
 * the nearest grid slot given the current grid dimensions.
 */
export function snapToSlot(
  fx: number,
  fy: number,
  grid: BattlefieldGrid,
): BattlefieldSlot {
  const cols = Math.max(1, grid.cols);
  const rows = Math.max(1, grid.rows);
  return {
    col: clampInt(Math.round(fx * (cols - 1)), 0, cols - 1),
    row: clampInt(Math.round(fy * (rows - 1)), 0, rows - 1),
  };
}

/**
 * Convert a slot into a fraction 0..1 along each axis representing where
 * the card's top-left corner should sit within the usable (container minus
 * one card size) area. Rendering layer multiplies by `container - card` to
 * get absolute px.
 */
export function slotFraction(
  slot: BattlefieldSlot,
  grid: BattlefieldGrid,
): { fx: number; fy: number } {
  const cols = Math.max(1, grid.cols);
  const rows = Math.max(1, grid.rows);
  return {
    fx: cols === 1 ? 0 : slot.col / (cols - 1),
    fy: rows === 1 ? 0 : slot.row / (rows - 1),
  };
}

/** Whether two slots refer to the same cell. */
export function sameSlot(a: BattlefieldSlot, b: BattlefieldSlot): boolean {
  return a.row === b.row && a.col === b.col;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Per-card slot address including sub-slot (0..2) — the same tuple the
 *  server uses on the wire: `wire_x = col * 3 + subSlot`. */
export type BattlefieldSlotFull = {
  row: number;
  col: number;
  subSlot: number;
  /** How many other cards are attached to THIS card (aura / equipment
   *  chain, etc.). Used by `computeCellWidths` to widen the parent's
   *  cell so the fanned children don't overlap the neighboring column,
   *  matching Cockatrice's `TableZone::computeCardStackWidths`. */
  attachedChildCount?: number;
};

/** Per-cell layout metrics: how much horizontal room a `(row, col)` cell
 *  needs to fit its widest stack. Ported from Cockatrice's
 *  `TableZone::cardStackWidth` map (table_zone.cpp:275-307). */
export type CellWidthMap = Map<string, number>;

const cellKey = (row: number, col: number) => `${row}:${col}`;

/** Metrics for a battlefield layout, passed together to positioning and
 *  snap helpers so all callers see the same widths. */
export interface BattlefieldLayoutOpts {
  cardWidthPx: number;
  cardHeightPx: number;
  gapXPx?: number;
  gapYPx?: number;
  marginLeftPx?: number;
  marginRightPx?: number;
  marginTopPx?: number;
  stackOffsetXPx?: number;
  stackOffsetYPx?: number;
  minCols?: number;
  rows?: number;
}

interface Resolved {
  cardW: number;
  cardH: number;
  gapX: number;
  gapY: number;
  mLeft: number;
  mRight: number;
  mTop: number;
  stackX: number;
  stackY: number;
  minCols: number;
  rows: number;
}

function resolve(opts: BattlefieldLayoutOpts): Resolved {
  return {
    cardW: opts.cardWidthPx,
    cardH: opts.cardHeightPx,
    gapX: opts.gapXPx ?? BATTLEFIELD_GAP_PX,
    gapY: opts.gapYPx ?? BATTLEFIELD_ROW_PADDING_PX,
    mLeft: opts.marginLeftPx ?? BATTLEFIELD_MARGIN_LEFT_PX,
    mRight: opts.marginRightPx ?? BATTLEFIELD_MARGIN_RIGHT_PX,
    mTop: opts.marginTopPx ?? BATTLEFIELD_MARGIN_TOP_PX,
    stackX: opts.stackOffsetXPx ?? STACK_OFFSET_PX,
    stackY: opts.stackOffsetYPx ?? STACK_OFFSET_Y_PX,
    minCols: opts.minCols ?? BATTLEFIELD_MIN_COLS,
    rows: opts.rows ?? BATTLEFIELD_ROWS,
  };
}

/** Build the per-cell horizontal footprint map — for each `(row, col)`
 *  cell holding stacked cards, width = `cardW + (stackCount - 1) *
 *  stackOffsetX`. Cells not in the map default to `cardW`. Mirrors
 *  Cockatrice's `computeCardStackWidths` PER-ROW: stacks in row 0 only
 *  push cols right in row 0, they don't ripple to other rows. */
export function computeCellWidths(
  cards: readonly BattlefieldSlotFull[],
  opts: BattlefieldLayoutOpts,
): CellWidthMap {
  const { cardW, stackX } = resolve(opts);
  // Count = max(subSlot + 1) per cell so cells with only sub-slot 2
  // occupied still allocate width for the whole stack up to that sub.
  const stackCounts = new Map<string, number>();
  // Track total cards per cell and the max attach count of any card in
  // that cell. Cockatrice's `computeCardStackWidths` picks EITHER stack
  // OR attach based on cell occupancy: single-occupant cells use the
  // card's attach count (parent + N children fan), multi-card cells use
  // stack count. See table_zone.cpp:275-307.
  const cellCardCount = new Map<string, number>();
  const cellMaxAttach = new Map<string, number>();
  for (const c of cards) {
    const k = cellKey(c.row, c.col);
    const n = (c.subSlot ?? 0) + 1;
    stackCounts.set(k, Math.max(stackCounts.get(k) ?? 0, n));
    cellCardCount.set(k, (cellCardCount.get(k) ?? 0) + 1);
    const attach = c.attachedChildCount ?? 0;
    if (attach > (cellMaxAttach.get(k) ?? 0)) {
      cellMaxAttach.set(k, attach);
    }
  }
  const widths: CellWidthMap = new Map();
  const keys = new Set([...stackCounts.keys(), ...cellMaxAttach.keys()]);
  for (const k of keys) {
    const stack = stackCounts.get(k) ?? 1;
    const occupants = cellCardCount.get(k) ?? 0;
    const attach = cellMaxAttach.get(k) ?? 0;
    // Cockatrice's exact rule: single-card cell → 1 + attach; else →
    // stackCount. Attach and stack aren't summed — a two-card stack
    // where one has attachments still uses stack-count width. Multi-
    // stack with heavy attach is an unusual case anyway.
    const factor = occupants === 1 ? 1 + attach : stack;
    widths.set(k, cardW + (factor - 1) * stackX);
  }
  return widths;
}

/** X-position (px) of the LEFT edge of column `col` in row `row`. Sums
 *  the widths of all prior columns in that row + inter-column gaps. */
export function columnLeftX(
  row: number,
  col: number,
  widths: CellWidthMap,
  opts: BattlefieldLayoutOpts,
): number {
  const { cardW, mLeft, gapX } = resolve(opts);
  let x = mLeft;
  for (let i = 0; i < col; i++) {
    x += (widths.get(cellKey(row, i)) ?? cardW) + gapX;
  }
  return x;
}

/** Y-position (px) of the TOP edge of row `row`. Uniform across the
 *  battlefield since rows never stretch (only columns do). */
export function rowTopY(row: number, opts: BattlefieldLayoutOpts): number {
  const { cardH, mTop, gapY } = resolve(opts);
  return mTop + row * (cardH + gapY);
}

/** Absolute pixel top-left of a specific card slot, accounting for the
 *  card's sub-slot diagonal offset. Cards at the same `(row, col)` fan
 *  diagonally by `(stackX, stackY)` per sub-slot. */
export function slotOriginPx(
  slot: BattlefieldSlotFull,
  widths: CellWidthMap,
  opts: BattlefieldLayoutOpts,
): { x: number; y: number } {
  const { stackX, stackY } = resolve(opts);
  const sub = slot.subSlot ?? 0;
  return {
    x: columnLeftX(slot.row, slot.col, widths, opts) + sub * stackX,
    y: rowTopY(slot.row, opts) + sub * stackY,
  };
}

/** Highest column index occupied in each row (-1 for empty rows). Used
 *  to size the content area past the last card so a drop target remains
 *  visible on the buffer column to the right of the rightmost stack. */
export function maxOccupiedColByRow(
  cards: readonly BattlefieldSlotFull[],
  rows: number,
): number[] {
  const out = new Array<number>(rows).fill(-1);
  for (const c of cards) {
    if (c.row >= 0 && c.row < rows) {
      out[c.row] = Math.max(out[c.row], c.col);
    }
  }
  return out;
}

/** Grand total content width — the rightmost row's right edge (widest
 *  row wins), plus right margin. Includes one buffer column past the
 *  rightmost card in each row so there's always somewhere to drop a
 *  new card on the right, matching Cockatrice's `resizeToContents`. */
export function computeContentWidth(
  widths: CellWidthMap,
  cards: readonly BattlefieldSlotFull[],
  opts: BattlefieldLayoutOpts,
): number {
  const r = resolve(opts);
  const maxCols = maxOccupiedColByRow(cards, r.rows);
  let maxRight = 0;
  for (let row = 0; row < r.rows; row++) {
    // Extend one column past the rightmost card, and enforce the min
    // column count so an empty battlefield still reads as ≥5 cols wide.
    const lastCol = Math.max(r.minCols - 1, maxCols[row] + 1);
    let x = r.mLeft;
    for (let i = 0; i <= lastCol; i++) {
      x += (widths.get(cellKey(row, i)) ?? r.cardW);
      if (i < lastCol) x += r.gapX;
    }
    maxRight = Math.max(maxRight, x);
  }
  return maxRight + r.mRight;
}

/** Content height — margin + rows * (card + row gap), minus the trailing
 *  row's gap. Rows are uniform so no per-row max is needed. */
export function computeContentHeight(opts: BattlefieldLayoutOpts): number {
  const r = resolve(opts);
  return r.mTop + r.rows * r.cardH + (r.rows - 1) * r.gapY;
}

/** Snap an absolute pixel position (relative to the content div) to a
 *  `(row, col, subSlot)` slot. Walks the row's cumulative widths to find
 *  the containing column, then decides the sub-slot from the leftover
 *  x-offset. Mirrors Cockatrice's `TableZone::mapToGrid`. */
export function snapPxToSlot(
  xPx: number,
  yPx: number,
  widths: CellWidthMap,
  opts: BattlefieldLayoutOpts,
): BattlefieldSlotFull {
  const r = resolve(opts);
  const yInGrid = yPx - r.mTop + r.gapY / 2;
  const rowH = r.cardH + r.gapY;
  const row = clampInt(Math.floor(yInGrid / rowH), 0, r.rows - 1);

  const xInGrid = xPx - r.mLeft + r.gapX / 2;
  let acc = 0;
  let col = 0;
  while (true) {
    const w = widths.get(cellKey(row, col)) ?? r.cardW;
    const step = w + r.gapX;
    if (acc + step > xInGrid) break;
    acc += step;
    col += 1;
    // Bail after a reasonable ceiling so a runaway pointer doesn't loop.
    if (col > 2048) break;
  }
  const xInCol = Math.max(0, xInGrid - acc);
  const subSlot = clampInt(
    Math.floor(xInCol / r.stackX),
    0,
    SUBSLOTS_PER_COLUMN - 1,
  );
  return { row, col: Math.max(0, col), subSlot };
}
