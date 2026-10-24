
export const CARD_WIDTH = 'var(--card-width, 72px)';
export const CARD_HEIGHT = 'var(--card-height, 102px)';

/** Same card rotated 90° — used for the tapped-sideways library stack. */
export const CARD_SIDEWAYS_WIDTH = CARD_HEIGHT;
export const CARD_SIDEWAYS_HEIGHT = CARD_WIDTH;

/** Canonical MTG card back — reused wherever a face-down card renders. */
export { CARD_BACK_URL } from '@app/services';

export const CARD_CORNER_RADIUS = 'var(--card-corner-radius, 7.5%)';
