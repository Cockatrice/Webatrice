import { act, render, screen } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';

import { withMockColorSchemeMedia, type MockColorSchemeMedia } from '../../__test-utils__';
import { makeSettingsHook } from '../../hooks/__mocks__/useSettings';
import { usePreferences, useSettings } from '../../hooks/useSettings';
import { LoadingState } from '../../hooks/useSharedStore';
import { PALETTES, THEME_MODE_STORAGE_KEY, THEME_NAME_STORAGE_KEY } from '@app/services';
import { PREFERENCE_DEFAULTS, ThemeMode, ThemeName } from '@app/types';
import AppThemeProvider from './AppThemeProvider';

vi.mock('../../hooks/useSettings');

function MuiMode() {
  const theme = useTheme();
  return <span data-testid="mui">{`${theme.palette.mode} ${theme.palette.primary.main}`}</span>;
}

const preferMode = (themeMode: ThemeMode, themeName: ThemeName = PREFERENCE_DEFAULTS.themeName) => {
  vi.mocked(usePreferences).mockReturnValue({ ...PREFERENCE_DEFAULTS, themeMode, themeName });
};

const renderApp = () => render(<AppThemeProvider><MuiMode /></AppThemeProvider>);
const documentTheme = () => document.documentElement.dataset.theme;
const documentScheme = () => document.documentElement.dataset.scheme;
const defaults = PALETTES[PREFERENCE_DEFAULTS.themeName];

describe('AppThemeProvider', () => {
  let media: MockColorSchemeMedia;

  beforeEach(() => {
    media = withMockColorSchemeMedia(false);
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook());
  });

  afterEach(() => {
    media.restore();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.scheme;
  });

  test('applies a fixed palette to the tokens and to MUI', () => {
    preferMode(ThemeMode.Dark);

    renderApp();

    expect(documentTheme()).toBe('dark');
    expect(screen.getByTestId('mui')).toHaveTextContent(`dark ${defaults.dark['accent-primary']}`);
  });

  test('switches live when the preference changes', () => {
    preferMode(ThemeMode.Dark);
    const { rerender } = renderApp();

    preferMode(ThemeMode.Light);
    rerender(<AppThemeProvider><MuiMode /></AppThemeProvider>);

    expect(documentTheme()).toBe('light');
    expect(screen.getByTestId('mui')).toHaveTextContent(`light ${defaults.light['accent-primary']}`);
  });

  test('System follows the operating system, including when it changes', () => {
    preferMode(ThemeMode.System);
    renderApp();
    expect(documentTheme()).toBe('light');

    act(() => media.setPrefersDark(true));

    expect(documentTheme()).toBe('dark');
    expect(screen.getByTestId('mui')).toHaveTextContent('dark');
  });

  test('a fixed palette ignores operating system changes', () => {
    preferMode(ThemeMode.Light);
    renderApp();

    act(() => media.setPrefersDark(true));

    expect(documentTheme()).toBe('light');
  });

  test('mirrors the mode for the next boot once settings have loaded', () => {
    preferMode(ThemeMode.Light);

    renderApp();

    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe(ThemeMode.Light);
  });

  test('keeps the boot palette while settings load, rather than the defaults', () => {
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook({ status: LoadingState.LOADING }));
    localStorage.setItem(THEME_MODE_STORAGE_KEY, ThemeMode.Light);
    media.setPrefersDark(true);
    preferMode(PREFERENCE_DEFAULTS.themeMode);

    renderApp();

    expect(documentTheme()).toBe('light');
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe(ThemeMode.Light);
  });

  test('applies the chosen theme to the tokens and to MUI, in either palette', () => {
    preferMode(ThemeMode.Dark, ThemeName.Carbon);
    const { rerender } = renderApp();

    expect(documentScheme()).toBe(ThemeName.Carbon);
    expect(screen.getByTestId('mui')).toHaveTextContent(`dark ${PALETTES[ThemeName.Carbon].dark['accent-primary']}`);

    preferMode(ThemeMode.Light, ThemeName.Carbon);
    rerender(<AppThemeProvider><MuiMode /></AppThemeProvider>);

    expect(documentScheme()).toBe(ThemeName.Carbon);
    expect(screen.getByTestId('mui')).toHaveTextContent(`light ${PALETTES[ThemeName.Carbon].light['accent-primary']}`);
  });

  test('falls back to the default theme for an unknown stored name', () => {
    vi.mocked(usePreferences).mockReturnValue({ ...PREFERENCE_DEFAULTS, themeName: 'sepia' as ThemeName });

    renderApp();

    expect(documentScheme()).toBe(PREFERENCE_DEFAULTS.themeName);
  });

  test('mirrors the theme for the next boot once settings have loaded', () => {
    preferMode(ThemeMode.Dark, ThemeName.Midnight);

    renderApp();

    expect(localStorage.getItem(THEME_NAME_STORAGE_KEY)).toBe(ThemeName.Midnight);
  });

  test('keeps the boot theme while settings load', () => {
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook({ status: LoadingState.LOADING }));
    localStorage.setItem(THEME_NAME_STORAGE_KEY, ThemeName.Carbon);
    preferMode(ThemeMode.Dark);

    renderApp();

    expect(documentScheme()).toBe(ThemeName.Carbon);
  });
});
