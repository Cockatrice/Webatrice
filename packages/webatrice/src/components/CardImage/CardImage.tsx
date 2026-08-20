import { useEffect, useState, type CSSProperties } from 'react';

import { Images } from '@app/images';

interface CardImageProps {
  /** Source URL. When missing / null / undefined the fallback renders
   *  straight away without trying a network request. */
  src?: string | null;
  /** Card name — used as the `title` on the fallback for hover tooltip
   *  identification, and as a fallback img `alt`. Deliberately NOT
   *  rendered as visible text; the fallback is logo-only so it stays
   *  visually clean and doesn't compete with the card-name overlays
   *  callers render themselves. */
  name?: string;
  /** Rendered className on both the real img and the fallback wrapper
   *  so the caller controls sizing/rounding/etc. in one place. */
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
}

/**
 * `<img>` with a built-in fallback. Renders the source URL like a
 * normal `<img>`; on a network / decoding error, swaps to a card-shaped
 * placeholder featuring the cockatrice logo centered above the card
 * name (if provided). Prevents the browser's broken-image icon from
 * ever appearing inside a card slot.
 *
 * `src` also participates in the fallback logic — passing `null` /
 * `undefined` / empty string skips the img entirely, useful when the
 * caller already knows there's no image URL to try.
 */
export default function CardImage({ src, name, className, style, draggable }: CardImageProps) {
  const [errored, setErrored] = useState(false);

  // Reset error state when the source changes so a fresh URL gets a
  // chance to load even after a previous URL failed for the same slot.
  useEffect(() => {
    setErrored(false);
  }, [src]);

  const showFallback = !src || errored;

  if (showFallback) {
    return (
      <div
        className={[
          className ?? '',
          // Card-like base: dark background so the logo reads, subtle
          // border so the placeholder looks like a real card frame
          // rather than a bare div.
          'relative flex items-center justify-center bg-[#0d1117] border border-[#30363d] overflow-hidden',
        ].join(' ')}
        style={style}
        title={name}
      >
        <img
          src={Images.Logo}
          alt=""
          draggable={false}
          // 55% keeps the logo dominant without touching the edges
          // even in the narrowest slot. `opacity-70` softens it so
          // the placeholder still reads as "missing art" rather than
          // a real card face.
          className="w-[55%] max-w-[160px] opacity-70 pointer-events-none"
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      // Empty alt matches the callers' original behavior — the visible
      // pill / label / hover-preview owns the accessible name. When
      // the fallback renders (`title` above) it uses the same name.
      alt=""
      draggable={draggable ?? false}
      className={className}
      style={style}
      onError={() => setErrored(true)}
    />
  );
}
