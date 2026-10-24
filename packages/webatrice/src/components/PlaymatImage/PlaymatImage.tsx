import { useState } from 'react';
import { type games } from '@cockatrice/datatrice';
import { playmatArtBox, playmatImageBox, type Size } from '@app/utils';

import { usePlaymatImage } from './usePlaymatImage';

interface Props { playmat: games.Playmat; area: Size | null }

export default function PlaymatImage({ playmat, area }: Props) {
  const { src, onError, isArtCrop, landscapeCard } = usePlaymatImage(playmat);
  const [loaded, setLoaded] = useState<{ src: string; size: Size }>();
  const size = loaded?.src === src ? loaded?.size : undefined;
  const sideways = landscapeCard && !isArtCrop;
  const upright = size && (sideways ? { width: size.height, height: size.width } : size);
  const frame = isArtCrop ? playmatArtBox : playmatImageBox;
  const box = upright && area ? frame(upright, playmat.params, area) : null;
  if (!src) {
    return null;
  }
  return <img key={src} src={src} alt="" draggable={false} onError={onError}
    className="absolute max-w-none"
    onLoad={(event) => setLoaded({ src, size: {
      width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight,
    } })}
    style={box ? {
      position: 'absolute', maxWidth: 'none', left: box.x + (sideways ? box.width : 0), top: box.y,
      width: sideways ? box.height : box.width, height: sideways ? box.width : box.height,
      transform: sideways ? 'rotate(90deg)' : undefined, transformOrigin: '0 0',
    } : { visibility: 'hidden' }} />;
}
