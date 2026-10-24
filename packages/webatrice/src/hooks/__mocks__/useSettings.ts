import type { SettingDTO } from '@app/services';
import { PREFERENCE_DEFAULTS, type PreferenceKey, type Preferences } from '@app/types';
import { LoadingState } from '../useSharedStore';
import type { SettingsHook } from '../useSettings';

export const makeSettings = (overrides: Partial<SettingDTO> = {}): SettingDTO =>
  ({ user: '*app', ...structuredClone(PREFERENCE_DEFAULTS), save: vi.fn(), ...overrides }) as SettingDTO;

export const makeSettingsHook = (overrides: Partial<SettingsHook> = {}): SettingsHook =>
  ({
    status: LoadingState.READY,
    value: makeSettings(),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as SettingsHook;

export const useSettings = vi.fn<() => SettingsHook>(() => makeSettingsHook());

export const getSettings = vi.fn<() => Promise<SettingDTO>>(() =>
  Promise.resolve(makeSettings())
);

export const usePreferences = vi.fn<() => Preferences>(() => PREFERENCE_DEFAULTS);

export const usePreference = vi.fn(<K extends PreferenceKey>(key: K): Preferences[K] => usePreferences()[key]);

export const getPreferencesSnapshot = vi.fn<() => Preferences>(() => PREFERENCE_DEFAULTS);

export const useMessageMacros = vi.fn<() => readonly string[]>(() => usePreferences().messageMacros);
