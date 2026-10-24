import type { CSSProperties } from 'react';

import { PALETTES, type ColorScheme, type PaletteToken } from '@app/services';
import type { ThemeName } from '@app/types';

const PREVIEW_TOKENS: readonly PaletteToken[] = [
  'bg-base',
  'bg-surface',
  'border-subtle',
  'accent-primary',
  'text-primary',
  'text-secondary',
  'text-muted',
];

export function hexToTriplet(hex: string): string {
  const value = hex.replace(/^#/, '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)).join(' ');
}

export function previewVars(themeName: ThemeName, scheme: ColorScheme): CSSProperties {
  return Object.fromEntries(
    PREVIEW_TOKENS.map((token) => [`--${token}`, hexToTriplet(PALETTES[themeName][scheme][token])]),
  ) as CSSProperties;
}
