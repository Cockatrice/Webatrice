import {
  battlefieldNaturalHeight,
  scaledBattlefieldLayout,
  SEAT_CARD_HEIGHT_PX,
  SEAT_CARD_WIDTH_PX,
} from '../battlefield/Battlefield/battlefieldLayout';
import { MANA_COLORS } from '../right-sidebar/PlayerInfoPanel/manaColors';

export const CARD_SCALE_MIN = 0.5;
export const CARD_SCALE_MAX = 2.5;

export const SEAT_BORDER_PX = 2;

export const INFO_FONT_MIN_PX = 10;
export const INFO_FONT_MAX_PX = 14;
export const INFO_PADDING_EM = 0.75;
export const INFO_GAP_EM = 0.5;
export const LIFE_TILE_EM = 6.2;
export const MANA_PIP_EM = 2;
export const MANA_GRID_COLUMNS = 4;
export const MANA_GRID_GAP_PX = 4;
export const SEAT_PILE_ROWS = 3;

export const HAND_ROW_CARD_RATIO = 0.6;
export const HAND_ROW_PAD_PX = 8;

export interface SeatFitOptions {
  inlineHand: boolean;
}

export function infoFontPx(scale: number): number {
  return Math.min(INFO_FONT_MAX_PX, Math.max(INFO_FONT_MIN_PX, INFO_FONT_MAX_PX * scale));
}

export function infoColumnHeightPx(scale: number): number {
  const rows = Math.ceil(MANA_COLORS.length / MANA_GRID_COLUMNS);
  const em = 2 * INFO_PADDING_EM + LIFE_TILE_EM + rows * MANA_PIP_EM + (1 + SEAT_PILE_ROWS) * INFO_GAP_EM;
  const manaGaps = Math.max(0, rows - 1) * MANA_GRID_GAP_PX;
  return em * infoFontPx(scale) + manaGaps + SEAT_PILE_ROWS * SEAT_CARD_WIDTH_PX * scale;
}

export function handRowHeightPx(scale: number): number {
  return SEAT_CARD_HEIGHT_PX * scale * HAND_ROW_CARD_RATIO + HAND_ROW_PAD_PX;
}

export function seatHeightPx(scale: number, { inlineHand }: SeatFitOptions): number {
  const play = battlefieldNaturalHeight(scaledBattlefieldLayout(scale)) + (inlineHand ? handRowHeightPx(scale) : 0);
  return SEAT_BORDER_PX + Math.max(play, infoColumnHeightPx(scale));
}

export function fitCardScale(seatHeight: number, options: SeatFitOptions): number {
  if (!Number.isFinite(seatHeight) || seatHeight <= 0) {
    return 1;
  }
  if (seatHeightPx(CARD_SCALE_MIN, options) >= seatHeight) {
    return CARD_SCALE_MIN;
  }
  if (seatHeightPx(CARD_SCALE_MAX, options) <= seatHeight) {
    return CARD_SCALE_MAX;
  }
  let fits = CARD_SCALE_MIN;
  let overflows = CARD_SCALE_MAX;
  while (overflows - fits > 0.0005) {
    const mid = (fits + overflows) / 2;
    if (seatHeightPx(mid, options) <= seatHeight) {
      fits = mid;
    } else {
      overflows = mid;
    }
  }
  return Math.floor(fits * 1000) / 1000;
}
