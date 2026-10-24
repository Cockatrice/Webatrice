import {
  BATTLEFIELD_GAP_PX,
  BATTLEFIELD_MARGIN_LEFT_PX,
  BATTLEFIELD_MARGIN_RIGHT_PX,
  BATTLEFIELD_MARGIN_TOP_PX,
  BATTLEFIELD_MIN_COLS,
  BATTLEFIELD_ROW_PADDING_PX,
  BATTLEFIELD_ROWS,
  STACK_OFFSET_PX,
  STACK_OFFSET_Y_PX,
  battlefieldNaturalHeight,
  computeCellWidths,
  computeContentHeight,
  computeContentWidth,
  rowTopY,
  scaledBattlefieldLayout,
  SEAT_CARD_HEIGHT_PX,
  SEAT_CARD_WIDTH_PX,
  slotOriginPx,
  snapPxToSlot,
  type BattlefieldLayoutOpts,
  type BattlefieldSlotFull,
} from './battlefieldLayout';
import { ROW_COUNT } from './gridMath';

function seatLayout(scale: number): BattlefieldLayoutOpts {
  return {
    cardWidthPx: SEAT_CARD_WIDTH_PX * scale,
    cardHeightPx: SEAT_CARD_HEIGHT_PX * scale,
    gapXPx: BATTLEFIELD_GAP_PX * scale,
    gapYPx: BATTLEFIELD_ROW_PADDING_PX * scale,
    marginLeftPx: BATTLEFIELD_MARGIN_LEFT_PX * scale,
    marginRightPx: BATTLEFIELD_MARGIN_RIGHT_PX * scale,
    marginTopPx: BATTLEFIELD_MARGIN_TOP_PX * scale,
    stackOffsetXPx: STACK_OFFSET_PX * scale,
    stackOffsetYPx: STACK_OFFSET_Y_PX * scale,
    minCols: BATTLEFIELD_MIN_COLS,
    rows: BATTLEFIELD_ROWS,
  };
}

const slot = (row: number, col: number, subSlot = 0, attachedChildCount?: number): BattlefieldSlotFull =>
  ({ row, col, subSlot, attachedChildCount });

describe('battlefieldLayout', () => {
  it('shares the wire grid constants with gridMath', () => {
    expect(BATTLEFIELD_ROWS).toBe(ROW_COUNT);
    expect([SEAT_CARD_WIDTH_PX, SEAT_CARD_HEIGHT_PX]).toEqual([72, 102]);
  });

  describe('computeCellWidths', () => {
    const opts = seatLayout(1);

    it('widens a cell by one stack offset per sub-slot up to the highest occupied one', () => {
      const widths = computeCellWidths([slot(0, 0, 0), slot(0, 0, 1), slot(0, 0, 2), slot(1, 0, 2), slot(1, 0, 0)], opts);
      expect(widths.get('0:0')).toBe(72 + 2 * 24);
      expect(widths.get('1:0')).toBe(72 + 2 * 24);
    });

    it('sizes a single-card cell by its attachment fan instead of its sub-slot', () => {
      const widths = computeCellWidths([slot(0, 1, 0, 2), slot(2, 3, 0)], opts);
      expect(widths.get('0:1')).toBe(72 + 2 * 24);
      expect(widths.get('2:3')).toBe(72);
    });

    it('uses the stack count, not the attachments, once a cell holds two cards', () => {
      const widths = computeCellWidths([slot(0, 0, 0, 3), slot(0, 0, 1)], opts);
      expect(widths.get('0:0')).toBe(72 + 24);
    });
  });

  describe('slot origins and content size', () => {
    it.each([1, 0.75, 1.5])('places a slot at margin + prior columns + sub-slot diagonal (scale %s)', (scale) => {
      const opts = seatLayout(scale);
      const widths = computeCellWidths([slot(1, 0, 0), slot(1, 0, 1)], opts);
      expect(slotOriginPx(slot(1, 2, 1), widths, opts)).toEqual({
        x: (20 + (96 + 35) + (72 + 35) + 24) * scale,
        y: (10 + (102 + 30) + 10) * scale,
      });
      expect(slotOriginPx(slot(0, 2, 0), widths, opts)).toEqual({ x: (20 + 2 * (72 + 35)) * scale, y: 10 * scale });
      expect(rowTopY(2, opts)).toBe((10 + 2 * (102 + 30)) * scale);
    });

    it('reserves the minimum five columns on an empty battlefield', () => {
      const opts = seatLayout(1);
      expect(computeContentWidth(new Map(), [], opts)).toBe(20 + 5 * 72 + 4 * 35 + 15);
      expect(computeContentHeight(opts)).toBe(10 + 3 * 102 + 2 * 30);
    });

    it('scales every desktop metric with the card and reserves room for a full stack below the lands', () => {
      expect(scaledBattlefieldLayout(1.5)).toEqual(seatLayout(1.5));
      expect(battlefieldNaturalHeight(scaledBattlefieldLayout(1))).toBe(10 + 3 * 102 + 2 * 30 + 2 * 10);
      expect(battlefieldNaturalHeight(scaledBattlefieldLayout(2))).toBe(2 * (10 + 3 * 102 + 2 * 30 + 2 * 10));
    });

    it('extends one buffer column past the rightmost card of the widest row', () => {
      const opts = seatLayout(1);
      const cards = [slot(2, 6, 0), slot(2, 6, 1)];
      const widths = computeCellWidths(cards, opts);
      expect(computeContentWidth(widths, cards, opts)).toBe(20 + 8 * 72 + 24 + 7 * 35 + 15);
    });
  });

  describe('snapPxToSlot', () => {
    const opts = seatLayout(1);
    const widths = computeCellWidths([slot(0, 0, 0), slot(0, 0, 1), slot(0, 0, 2)], opts);

    it('picks the row by the card + padding pitch, snapping half a padding early', () => {
      expect(snapPxToSlot(30, 10, widths, opts).row).toBe(0);
      expect(snapPxToSlot(30, 10 + 102 + 15, widths, opts).row).toBe(1);
      expect(snapPxToSlot(30, 10_000, widths, opts).row).toBe(2);
      expect(snapPxToSlot(30, -500, widths, opts).row).toBe(0);
    });

    it('resolves the three sub-slots of a full stack and clamps past the last one', () => {
      expect(snapPxToSlot(20, 10, widths, opts)).toEqual({ row: 0, col: 0, subSlot: 0 });
      expect(snapPxToSlot(20 + 24 - 17.5, 10, widths, opts)).toEqual({ row: 0, col: 0, subSlot: 1 });
      expect(snapPxToSlot(20 + 48 - 17.5, 10, widths, opts)).toEqual({ row: 0, col: 0, subSlot: 2 });
      expect(snapPxToSlot(20 + 120 + 17.4, 10, widths, opts)).toEqual({ row: 0, col: 0, subSlot: 2 });
      expect(snapPxToSlot(20 + 120 + 17.5, 10, widths, opts)).toEqual({ row: 0, col: 1, subSlot: 0 });
    });

  });

});
