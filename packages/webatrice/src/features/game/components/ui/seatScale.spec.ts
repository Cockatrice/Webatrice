import type { BattlefieldSlotFull } from '../battlefield/Battlefield/battlefieldLayout';
import { CARD_SCALE_MIN } from './seatFit';
import {
  battlefieldColumns,
  battlefieldFitWidth,
  FIT_MAX_COLUMNS,
  seatCardScale,
  seatChromeWidthPx,
  seatWidthScale,
} from './seatScale';

const row = (row: number, columns: number, stacked = 1): BattlefieldSlotFull[] =>
  Array.from({ length: columns }, (_, col) => Array.from({ length: stacked }, (__, subSlot) => ({ row, col, subSlot }))).flat();

describe('seatScale', () => {
  it('counts the columns of the widest row', () => {
    expect(battlefieldColumns([])).toBe(0);
    expect(battlefieldColumns([...row(0, 3), ...row(2, 6)])).toBe(6);
  });

  it('fits up to seven columns plus the drop column, and no more', () => {
    const seven = battlefieldFitWidth(row(2, FIT_MAX_COLUMNS));
    expect(seven).toBe(20 + 8 * 72 + 7 * 35 + 15);
    expect(battlefieldFitWidth(row(2, 12))).toBe(seven);
    expect(battlefieldFitWidth(row(2, 3))).toBeLessThan(seven);
  });

  it('widens the fit for stacked cards', () => {
    expect(battlefieldFitWidth(row(0, 4, 3))).toBe(battlefieldFitWidth(row(0, 4)) + 4 * 2 * 24);
  });

  it('solves for the scale at which the info, stack and battlefield columns fill the seat width', () => {
    const fit = battlefieldFitWidth(row(2, 7));
    const scale = seatWidthScale(800, fit, { verticalHand: false });
    expect(seatChromeWidthPx(scale, { verticalHand: false }) + fit * scale).toBeCloseTo(800, 0);
    expect(seatWidthScale(800, fit, { verticalHand: true })).toBeLessThan(scale);
  });

  it('never lets the info column get narrower than its minimum', () => {
    const narrow = { verticalHand: false };
    expect(seatChromeWidthPx(0.2, narrow) - seatChromeWidthPx(0.1, narrow)).toBeCloseTo(1.2 * 72 * 0.1, 6);
  });

  it('takes the smaller of the height and width fits, clamped to the readable range', () => {
    const slots = row(2, 7);
    const widthScale = seatWidthScale(800, battlefieldFitWidth(slots), { verticalHand: false });
    expect(seatCardScale({ seatWidth: 800, heightScale: 2, slots, verticalHand: false })).toBeCloseTo(widthScale, 2);
    expect(seatCardScale({ seatWidth: 800, heightScale: 0.6, slots, verticalHand: false })).toBe(0.6);
    expect(seatCardScale({ seatWidth: 120, heightScale: 1, slots, verticalHand: false })).toBe(CARD_SCALE_MIN);
    expect(seatCardScale({ seatWidth: 0, heightScale: 0.9, slots, verticalHand: false })).toBe(0.9);
  });

  it('keeps an eight-column seat at the seven-column scale', () => {
    const seven = seatCardScale({ seatWidth: 900, heightScale: 2, slots: row(2, 7), verticalHand: false });
    expect(seatCardScale({ seatWidth: 900, heightScale: 2, slots: row(2, 9), verticalHand: false })).toBe(seven);
  });
});
