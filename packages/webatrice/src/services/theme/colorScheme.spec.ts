import { withMockColorSchemeMedia, type MockColorSchemeMedia } from '../../__test-utils__';
import { PREFERENCE_DEFAULTS, ThemeMode, ThemeName } from '@app/types';
import {
  applyColorScheme,
  bootColorScheme,
  bootThemeMode,
  bootThemeName,
  followBootColorScheme,
  readBootThemeMode,
  readBootThemeName,
  resolveThemeName,
  resolveColorScheme,
  subscribeToSystemColorScheme,
  systemColorScheme,
  THEME_MODE_STORAGE_KEY,
  THEME_NAME_STORAGE_KEY,
  writeBootThemeMode,
  writeBootThemeName,
} from './colorScheme';

describe('colorScheme', () => {
  let media: MockColorSchemeMedia | undefined;

  afterEach(() => {
    media?.restore();
    media = undefined;
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.scheme;
    document.documentElement.style.colorScheme = '';
  });

  test('a fixed mode ignores the system; System follows it', () => {
    expect(resolveColorScheme(ThemeMode.Light, 'dark')).toBe('light');
    expect(resolveColorScheme(ThemeMode.Dark, 'light')).toBe('dark');
    expect(resolveColorScheme(ThemeMode.System, 'light')).toBe('light');
    expect(resolveColorScheme(ThemeMode.System, 'dark')).toBe('dark');
  });

  test('reads the operating system preference, and reports its changes', () => {
    media = withMockColorSchemeMedia(false);
    expect(systemColorScheme()).toBe('light');

    const onChange = vi.fn();
    const unsubscribe = subscribeToSystemColorScheme(onChange);
    media.setPrefersDark(true);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(systemColorScheme()).toBe('dark');

    unsubscribe();
    media.setPrefersDark(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('assumes dark where the browser cannot report a preference', () => {
    expect(window.matchMedia).toBeUndefined();
    expect(systemColorScheme()).toBe('dark');
    expect(subscribeToSystemColorScheme(vi.fn())).toEqual(expect.any(Function));
  });

  test('applies a palette and a theme to the document root', () => {
    applyColorScheme('light', ThemeName.Carbon);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.scheme).toBe(ThemeName.Carbon);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  test('round-trips the boot mirror and ignores junk in it', () => {
    expect(readBootThemeMode()).toBeUndefined();
    expect(bootThemeMode()).toBe(ThemeMode.Dark);

    writeBootThemeMode(ThemeMode.System);
    expect(readBootThemeMode()).toBe(ThemeMode.System);

    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'sepia');
    expect(readBootThemeMode()).toBeUndefined();
  });

  test('boots with the mirrored mode resolved against the system', () => {
    media = withMockColorSchemeMedia(false);
    writeBootThemeMode(ThemeMode.System);

    bootColorScheme();

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('boots dark when nothing was mirrored', () => {
    media = withMockColorSchemeMedia(false);

    bootColorScheme();

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  test('a window that never loads settings follows the mirror and the system', () => {
    media = withMockColorSchemeMedia(true);
    writeBootThemeMode(ThemeMode.Light);
    bootColorScheme();
    const stop = followBootColorScheme();

    writeBootThemeMode(ThemeMode.System);
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_MODE_STORAGE_KEY }));
    expect(document.documentElement.dataset.theme).toBe('dark');

    media.setPrefersDark(false);
    expect(document.documentElement.dataset.theme).toBe('light');

    stop();
    media.setPrefersDark(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('accepts only known theme names, falling back to the default', () => {
    expect(resolveThemeName(ThemeName.Midnight)).toBe(ThemeName.Midnight);
    expect(resolveThemeName('sepia')).toBe(PREFERENCE_DEFAULTS.themeName);
    expect(resolveThemeName(undefined)).toBe(PREFERENCE_DEFAULTS.themeName);
  });

  test('boots a new visitor in the default theme, and a returning one in Midnight until a theme is mirrored', () => {
    expect(bootThemeName()).toBe(PREFERENCE_DEFAULTS.themeName);

    writeBootThemeMode(ThemeMode.Dark);
    expect(bootThemeName()).toBe(ThemeName.Midnight);

    writeBootThemeName(ThemeName.Carbon);
    expect(readBootThemeName()).toBe(ThemeName.Carbon);
    expect(bootThemeName()).toBe(ThemeName.Carbon);

    localStorage.setItem(THEME_NAME_STORAGE_KEY, 'neon');
    expect(readBootThemeName()).toBeUndefined();
  });

  test('boots with the mirrored theme, and follows it from another window', () => {
    media = withMockColorSchemeMedia(true);
    writeBootThemeName(ThemeName.Midnight);
    bootColorScheme();
    expect(document.documentElement.dataset.scheme).toBe(ThemeName.Midnight);

    const stop = followBootColorScheme();
    writeBootThemeName(ThemeName.Carbon);
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_NAME_STORAGE_KEY }));
    expect(document.documentElement.dataset.scheme).toBe(ThemeName.Carbon);
    stop();
  });
});
