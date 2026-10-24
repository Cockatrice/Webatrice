import { useMemo, useSyncExternalStore } from 'react';

import { migrateSetting, SettingDTO } from '@app/services';
import { APP_USER, PREFERENCE_DEFAULTS, PreferenceKey, Preferences } from '@app/types';
import { LEGACY_PLAYMAT_SETTINGS_KEY } from '../services/dexie/playmatSettings';
import { createSharedStore, Loadable, LoadingState, useSharedStore } from './useSharedStore';

export const settingsStore = createSharedStore<SettingDTO>(async () => {
  let loaded: SettingDTO | undefined = await SettingDTO.get(APP_USER);
  if (!loaded) {
    loaded = new SettingDTO(APP_USER);
    loaded.version = 2;
    migrateSetting(loaded);
    loaded.themeName = PREFERENCE_DEFAULTS.themeName;
    await loaded.save();
  }
  const version = loaded.version;
  const migrated = migrateSetting(loaded);
  if (version !== migrated.version) {
    await migrated.save();
  }
  try {
    globalThis.localStorage?.removeItem(LEGACY_PLAYMAT_SETTINGS_KEY);
  } catch { /* storage unavailable */ }
  return migrated;
});
const store = settingsStore;

export type SettingsHook = Loadable<SettingDTO> & {
  update: (patch: Partial<SettingDTO>) => Promise<void>;
};

export function useSettings(): SettingsHook {
  const state = useSharedStore(store);

  const update = async (patch: Partial<SettingDTO>) => {
    const current = store.peek();
    if (!current) {
      throw new Error('useSettings.update called before settings loaded');
    }
    Object.assign(current, patch);
    await current.save();
    store.setValue(current);
  };

  return { ...state, update };
}

export const getSettings = (): Promise<SettingDTO> => store.whenReady();

export function usePreferences(): Preferences {
  const state = useSharedStore(store);
  return useMemo(
    () => (state.status === LoadingState.READY && state.value ? { ...state.value } : PREFERENCE_DEFAULTS),
    [state],
  );
}

export function usePreference<K extends PreferenceKey>(key: K): Preferences[K] {
  return useSyncExternalStore(store.subscribe, () => getPreferencesSnapshot()[key]);
}

export function getPreferencesSnapshot(): Preferences {
  return store.peek() ?? PREFERENCE_DEFAULTS;
}

export function useMessageMacros(): readonly string[] {
  return usePreference('messageMacros');
}
