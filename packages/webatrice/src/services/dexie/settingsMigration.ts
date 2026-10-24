import { PREFERENCE_DEFAULTS, PreferenceKey, Preferences, SETTINGS_VERSION, Setting, ThemeMode, ThemeName } from '@app/types';
import { LANGUAGE_STORAGE_KEY, resolveSupportedLanguage } from '@app/utils';

import { LEGACY_PLAYMAT_SETTINGS_KEY, parsePlaymatSettings } from './playmatSettings';

type SettingRow = Partial<Setting> & { user: string };

const MIGRATIONS: Record<number, (row: SettingRow) => void> = {
  1: (row) => fillPreferenceDefaults(row),
  2: (row) => {
    row.themeMode = ThemeMode.Dark;
    row.language = legacyLanguageChoice() ?? '';
  },
  3: (row) => {
    if (row.user !== '*app') {
      return;
    }
    try {
      row.playmatSettings = parsePlaymatSettings(globalThis.localStorage?.getItem(LEGACY_PLAYMAT_SETTINGS_KEY) ?? null);
    } catch {
      row.playmatSettings = structuredClone(PREFERENCE_DEFAULTS.playmatSettings);
    }
  },
  4: (row) => {
    row.animationsChosen = row.tapAnimation === false;
    if (row.animationsChosen) {
      row.arrowDrawAnimation = false;
      row.lifeCounterAnimations = false;
      row.battlefieldFlash = false;
    }
  },
  5: (row) => {
    row.themeName = ThemeName.Midnight;
  },
};

function legacyLanguageChoice(): string | undefined {
  let cached: string | undefined;
  try {
    cached = resolveSupportedLanguage(globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return undefined;
  }
  return cached !== browserLanguage() ? cached : undefined;
}

function browserLanguage(): string | undefined {
  const nav = globalThis.navigator;
  const tags = nav?.languages?.length ? nav.languages : [nav?.language];
  return tags.map(resolveSupportedLanguage).find((language) => language !== undefined);
}

function hasDefaultType(key: PreferenceKey, value: unknown): boolean {
  if (key === 'playmatSettings') {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }
  const fallback = PREFERENCE_DEFAULTS[key];
  return Array.isArray(fallback) ? Array.isArray(value) : typeof value === typeof fallback;
}

export function fillPreferenceDefaults(row: Partial<Preferences>): void {
  const target = row as Record<PreferenceKey, unknown>;
  for (const key of Object.keys(PREFERENCE_DEFAULTS) as PreferenceKey[]) {
    if (!hasDefaultType(key, target[key])) {
      target[key] = structuredClone(PREFERENCE_DEFAULTS[key]);
    }
  }
}

export function migrateSetting<T extends SettingRow>(row: T): T & Setting {
  const from = row.version ?? 0;
  for (let version = from + 1; version <= SETTINGS_VERSION; version++) {
    MIGRATIONS[version]?.(row);
  }
  fillPreferenceDefaults(row);
  row.playmatSettings = parsePlaymatSettings(JSON.stringify(row.playmatSettings));
  row.version = Math.max(from, SETTINGS_VERSION);
  return row as T & Setting;
}
