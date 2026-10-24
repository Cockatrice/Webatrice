import type { ReactNode } from 'react';

import { useDeckCardImage } from '../../hooks/useDeckCardImage';

export function DeckCardImage({
  urls, alt, children, className = 'h-full w-full', lazy = false,
}: {
  urls: readonly string[];
  alt: string;
  children: ReactNode;
  className?: string;
  lazy?: boolean;
}) {
  const { src, loaded, onLoad, onError, ref } = useDeckCardImage(urls);
  return (
    <span className={`relative block overflow-hidden bg-bg-elevated ${className}`}>
      {!src && children}
      {src && (
        <img
          ref={ref}
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: loaded ? 1 : 0 }}
          loading={lazy ? 'lazy' : undefined}
          draggable={false}
          onLoad={onLoad}
          onError={onError}
        />
      )}
    </span>
  );
}
