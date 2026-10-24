import { type PlaymatSettings } from '@app/types';
import { getPreferencesSnapshot, getSettings, settingsStore, usePreference } from './useSettings';

export { DEFAULT_PLAYMAT_SETTINGS, PlaymatVisibility, PlaymatMode, PlaymatFallbackBehavior } from '@app/types';
export type { PlaymatSettings } from '@app/types';
export { parsePlaymatSettings } from '../services/dexie/playmatSettings';

export const getPlaymatSettings = (): PlaymatSettings => getPreferencesSnapshot().playmatSettings;

export function setPlaymatSettings(patch: Partial<PlaymatSettings>): Promise<void> {
  const current = settingsStore.peek();
  if (!current) {
    return getSettings().then(() => setPlaymatSettings(patch));
  }
  current.playmatSettings = { ...current.playmatSettings, ...patch };
  settingsStore.setValue(current);
  return current.save().then(() => undefined);
}

export function usePlaymatSettings(): PlaymatSettings {
  return usePreference('playmatSettings');
}

export function usePlaymatSettingsState(): [PlaymatSettings, typeof setPlaymatSettings] {
  return [usePlaymatSettings(), setPlaymatSettings];
}
