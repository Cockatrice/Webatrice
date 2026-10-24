const AVATAR_DATA_URI_PREFIX = 'data:image/png;base64,';

export function avatarDataUri(bmp: Uint8Array | undefined): string | null {
  if (!bmp || bmp.byteLength === 0) {
    return null;
  }
  let binary = '';
  for (let i = 0; i < bmp.byteLength; i += 1) {
    binary += String.fromCharCode(bmp[i]);
  }
  return AVATAR_DATA_URI_PREFIX + btoa(binary);
}
