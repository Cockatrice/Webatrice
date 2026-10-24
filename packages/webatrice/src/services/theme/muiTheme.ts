import { createTheme, type Theme } from '@mui/material/styles';

import type { ThemeName } from '@app/types';

import { PALETTES, type ColorScheme } from './palettes';

export function createAppTheme(themeName: ThemeName, scheme: ColorScheme): Theme {
  const palette = PALETTES[themeName][scheme];
  return createTheme({
    palette: {
      mode: scheme,
      primary: { main: palette['accent-primary'], contrastText: palette['text-on-accent'] },
      secondary: { main: palette['accent-secondary'] },
      error: { main: palette['status-danger'] },
      success: { main: palette['status-success'] },
      warning: { main: palette['status-warning'] },
      background: { default: palette['bg-base'], paper: palette['bg-surface'] },
      text: {
        primary: palette['text-primary'],
        secondary: palette['text-secondary'],
        disabled: palette['text-disabled'],
      },
      divider: palette['border-subtle'],
    },
  });
}
