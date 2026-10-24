import { useEffect, useState, type CSSProperties } from 'react';
import { CardImage } from '@app/components';
import { usePreference } from '@app/hooks';
import { lookupCardsCached } from '@app/services';

function useLandscapeCard(name: string | undefined): boolean {
  const [landscape, setLandscape] = useState<{ name: string; value: boolean } | null>(null);
  useEffect(() => {
    if (!name) {
      return;
    }
    const controller = new AbortController();
    lookupCardsCached([name], controller.signal)
      .then((results) => {
        if (!controller.signal.aborted) {
          setLandscape({ name, value: !!results.get(name)?.landscape });
        }
      })
      .catch(() => {});
    return () => {
      controller.abort();
    };
  }, [name]);
  return !!name && landscape?.name === name && landscape.value;
}

interface PreviewCardImageProps {
  src: string;
  name?: string;
  className?: string;
  style?: CSSProperties;
}

export default function PreviewCardImage({ src, name, className, style }: PreviewCardImageProps) {
  const autoRotate = usePreference('autoRotateSidewaysLayoutCards');
  const sideways = useLandscapeCard(autoRotate ? name : undefined);

  if (!sideways) {
    return (
      <CardImage src={src} name={name} draggable={false} className={className} style={{ ...style, aspectRatio: '5 / 7' }} />
    );
  }
  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{ ...style, aspectRatio: '7 / 5' }}
      data-sideways
    >
      <CardImage
        src={src}
        name={name}
        draggable={false}
        className="absolute left-1/2 top-1/2 max-w-none"
        style={{
          width: `${(5 / 7) * 100}%`,
          height: `${(7 / 5) * 100}%`,
          transform: 'translate(-50%, -50%) rotate(90deg)',
          imageRendering: style?.imageRendering,
        }}
      />
    </div>
  );
}
