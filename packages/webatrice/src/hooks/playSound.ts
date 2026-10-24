import { soundEngine, type SoundName } from '@app/services';

import { getPreferencesSnapshot } from './useSettings';

export function playSound(name: SoundName): void {
  const { soundEnabled, soundTheme, masterVolume } = getPreferencesSnapshot();
  soundEngine.play(name, { enabled: soundEnabled, theme: soundTheme, volume: masterVolume });
}
