import { useMemo } from 'react';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

export function avatarDataUri(bmp: Uint8Array | undefined | null): string | null {
  if (!bmp || bmp.byteLength === 0) {
    return null;
  }
  let binary = '';
  for (let i = 0; i < bmp.byteLength; i += 1) {
    binary += String.fromCharCode(bmp[i]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export function useOwnAvatarUrl(): string | null {
  const avatarBmp = useAppSelector(server.Selectors.getUser)?.avatarBmp;
  return useMemo(() => avatarDataUri(avatarBmp), [avatarBmp]);
}
