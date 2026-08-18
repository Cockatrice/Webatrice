/**
 * Shared visual dimensions for MTG cards inside a PlayerBox.
 *
 * Base pixel size matches Cockatrice desktop's logical card dimensions
 * (72 × 102, from card_dimensions.h). CardScaleProvider multiplies these
 * by a viewport-derived scale and writes them onto document root as CSS
 * vars; the fallback here applies when no provider is mounted (isolated
 * previews, tests, storybook), so those environments render at 1×
 * Cockatrice-scale.
 */

export const CARD_WIDTH = 'var(--card-width, 72px)';
export const CARD_HEIGHT = 'var(--card-height, 102px)';

/** Same card rotated 90° — used for the tapped-sideways library stack. */
export const CARD_SIDEWAYS_WIDTH = CARD_HEIGHT;
export const CARD_SIDEWAYS_HEIGHT = CARD_WIDTH;

/** Canonical MTG card back — reused wherever a face-down card renders. */
export const CARD_BACK_URL =
  'https://backs.scryfall.io/normal/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';

/**
 * ~7.5% of the card width matches the real MTG corner curve. Prevents
 * the white JPG background from peeking through rounded corners without
 * eating into meaningful art.
 */
export const CARD_CORNER_RADIUS = '7.5%';
