const AVATAR_DATA_URI_PREFIX = 'data:image/png;base64,';

/**
 * Convert Cockatrice's wire `avatar_bmp` (raw image bytes, PNG despite
 * the name) into a data URL usable as a `<img src>` or CSS
 * `background-image`. Returns null for empty/missing bytes so callers
 * can fall back to a placeholder.
 *
 * Extracted from Player.tsx so both the player-details page and the
 * in-game PlayerBox (life-total background) can share the same
 * conversion.
 */
export function avatarSrc(bmp: Uint8Array | undefined | null): string | null {
  if (!bmp || bmp.byteLength === 0) {
    return null;
  }
  let binary = '';
  for (let i = 0; i < bmp.byteLength; i += 1) {
    binary += String.fromCharCode(bmp[i]);
  }
  return AVATAR_DATA_URI_PREFIX + btoa(binary);
}
