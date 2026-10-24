import { usePreference } from '@app/hooks';
import type { ZoneBackgroundZone } from '@app/types';

import PlaymatArt from '../../PlayerPlaymat/PlaymatArt';

export default function ZoneBackground({ zone }: { zone: ZoneBackgroundZone }) {
  const background = usePreference('zoneBackgrounds')?.[zone];
  if (!background?.cardName) {
    return null;
  }
  return <PlaymatArt art={background} testId={`zone-background-${zone}`} style={{ zIndex: -1 }} />;
}
