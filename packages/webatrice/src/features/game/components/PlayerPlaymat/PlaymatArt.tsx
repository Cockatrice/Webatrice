import { useEffect, useRef, useState, type CSSProperties } from 'react';

import type { games } from '@cockatrice/datatrice';
import { PlaymatImage } from '@app/components';
import type { Size } from '@app/utils';

interface PlaymatArtProps {
  art: games.Playmat;
  testId?: string;
  style?: CSSProperties;
}

export default function PlaymatArt({ art, testId, style }: PlaymatArtProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Size | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const measure = () => setArea({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={areaRef}
      data-testid={testId}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={style}
      aria-hidden="true"
    >
      <PlaymatImage playmat={art} area={area} />
    </div>
  );
}
