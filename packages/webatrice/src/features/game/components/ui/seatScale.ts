import {
  computeCellWidths,
  computeContentWidth,
  scaledBattlefieldLayout,
  SEAT_CARD_HEIGHT_PX,
  SEAT_CARD_WIDTH_PX,
  type BattlefieldSlotFull,
} from '../battlefield/Battlefield/battlefieldLayout';
import { CARD_SCALE_MAX, CARD_SCALE_MIN, SEAT_BORDER_PX } from './seatFit';

export const FIT_MAX_COLUMNS = 7;
export const INFO_COLUMN_PAD_PX = 21;
export const INFO_COLUMN_MIN_PX = 112;
export const STACK_COLUMN_PAD_PX = 16;
export const STACK_COLUMN_RATIO = 1.2;
export const VERTICAL_HAND_RATIO = 1.5;

export interface SeatColumnsOptions {
  verticalHand: boolean;
}

export function battlefieldColumns(slots: readonly BattlefieldSlotFull[]): number {
  return slots.reduce((most, slot) => Math.max(most, slot.col + 1), 0);
}

export function battlefieldFitWidth(slots: readonly BattlefieldSlotFull[]): number {
  const fitted = slots.filter((slot) => slot.col < FIT_MAX_COLUMNS);
  const opts = scaledBattlefieldLayout(1);
  return computeContentWidth(computeCellWidths(fitted, opts), fitted, opts);
}

export function seatChromeWidthPx(scale: number, { verticalHand }: SeatColumnsOptions): number {
  const hand = verticalHand ? SEAT_CARD_WIDTH_PX * VERTICAL_HAND_RATIO * scale : 0;
  return SEAT_BORDER_PX
    + Math.max(SEAT_CARD_HEIGHT_PX * scale + INFO_COLUMN_PAD_PX, INFO_COLUMN_MIN_PX)
    + STACK_COLUMN_RATIO * (SEAT_CARD_WIDTH_PX * scale + STACK_COLUMN_PAD_PX)
    + hand;
}

export function seatWidthPx(scale: number, fitWidth: number, options: SeatColumnsOptions): number {
  return seatChromeWidthPx(scale, options) + fitWidth * scale;
}

export function seatWidthScale(seatWidth: number, fitWidth: number, options: SeatColumnsOptions): number {
  let fits = 0;
  let overflows = CARD_SCALE_MAX * 2;
  if (seatWidthPx(overflows, fitWidth, options) <= seatWidth) {
    return overflows;
  }
  while (overflows - fits > 0.0005) {
    const mid = (fits + overflows) / 2;
    if (seatWidthPx(mid, fitWidth, options) <= seatWidth) {
      fits = mid;
    } else {
      overflows = mid;
    }
  }
  return fits;
}

export function seatCardScale({ seatWidth, heightScale, slots, verticalHand }: {
  seatWidth: number;
  heightScale: number;
  slots: readonly BattlefieldSlotFull[];
  verticalHand: boolean;
}): number {
  if (!(seatWidth > 0)) {
    return heightScale;
  }
  const widthScale = seatWidthScale(seatWidth, battlefieldFitWidth(slots), { verticalHand });
  const scale = Math.floor(Math.min(heightScale, widthScale) * 1000) / 1000;
  return Math.min(CARD_SCALE_MAX, Math.max(CARD_SCALE_MIN, scale));
}
