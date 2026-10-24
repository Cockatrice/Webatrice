import { PREFERENCE_DEFAULTS, ThemeMode, ThemeName } from '@app/types';

import type { ColorScheme } from './palettes';

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export const THEME_MODE_STORAGE_KEY = 'webatrice.themeMode';
export const THEME_NAME_STORAGE_KEY = 'webatrice.themeName';

export function systemColorScheme(): ColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

export function subscribeToSystemColorScheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(DARK_SCHEME_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function resolveColorScheme(mode: ThemeMode, system: ColorScheme): ColorScheme {
  switch (mode) {
    case ThemeMode.Light:
      return 'light';
    case ThemeMode.Dark:
      return 'dark';
    default:
      return system;
  }
}

export function resolveThemeName(value: unknown): ThemeName {
  return Object.values(ThemeName).find((name) => name === value) ?? PREFERENCE_DEFAULTS.themeName;
}

export function applyColorScheme(
  scheme: ColorScheme,
  themeName: ThemeName = PREFERENCE_DEFAULTS.themeName,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = scheme;
  root.dataset.scheme = themeName;
  root.style.colorScheme = scheme;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the next boot uses the defaults until settings load.
  }
}

export function readBootThemeMode(): ThemeMode | undefined {
  const stored = readStorage(THEME_MODE_STORAGE_KEY);
  return Object.values(ThemeMode).find((mode) => mode === stored);
}

export function writeBootThemeMode(mode: ThemeMode): void {
  writeStorage(THEME_MODE_STORAGE_KEY, mode);
}

export function readBootThemeName(): ThemeName | undefined {
  const stored = readStorage(THEME_NAME_STORAGE_KEY);
  return Object.values(ThemeName).find((name) => name === stored);
}

export function writeBootThemeName(name: ThemeName): void {
  writeStorage(THEME_NAME_STORAGE_KEY, name);
}

export const bootThemeMode = (): ThemeMode => readBootThemeMode() ?? ThemeMode.Dark;

export const bootThemeName = (): ThemeName =>
  readBootThemeName() ?? (readBootThemeMode() ? ThemeName.Midnight : PREFERENCE_DEFAULTS.themeName);

export function bootColorScheme(): void {
  applyColorScheme(resolveColorScheme(bootThemeMode(), systemColorScheme()), bootThemeName());
}

export function followBootColorScheme(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_MODE_STORAGE_KEY || event.key === THEME_NAME_STORAGE_KEY) {
      bootColorScheme();
    }
  };
  window.addEventListener('storage', onStorage);
  const unsubscribeSystem = subscribeToSystemColorScheme(bootColorScheme);
  return () => {
    window.removeEventListener('storage', onStorage);
    unsubscribeSystem();
  };
}
