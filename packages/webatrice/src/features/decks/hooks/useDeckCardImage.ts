import { useCallback, useState } from 'react';

import { useImageCandidates } from '@app/hooks';

export function useDeckCardImage(urls: readonly string[]) {
  const { src, onError } = useImageCandidates(urls);
  const [status, setStatus] = useState({ src, loaded: false });
  if (status.src !== src) {
    setStatus({ src, loaded: false });
  }
  const onLoad = useCallback(() => setStatus({ src, loaded: true }), [src]);
  const ref = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) {
      onLoad();
    }
  }, [onLoad]);
  return { src, loaded: status.src === src && status.loaded, onLoad, onError, ref };
}
