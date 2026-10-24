import fs from 'node:fs';
import path from 'node:path';

import { PREFERENCE_DEFAULTS, ThemeName } from '@app/types';

import { PALETTES, type ColorScheme, type Palette, type PaletteToken } from './palettes';

type Hex = string;

function cssBlocks(css: string): Map<string, Record<string, Hex>> {
  const blocks = new Map<string, Record<string, Hex>>();
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const tokens: Record<string, Hex> = {};
    for (const [, name, r, g, b] of body.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
      tokens[name] = `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    }
    for (const selector of selectors.split(',')) {
      blocks.set(selector.trim(), tokens);
    }
  }
  return blocks;
}

const channels = (hex: Hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex: Hex): number {
  const [r, g, b] = channels(hex)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Hex, b: Hex): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function composite(color: Hex, alpha: number, under: Hex): Hex {
  const top = channels(color);
  const bottom = channels(under);
  return `#${top.map((c, i) => Math.round(alpha * c + (1 - alpha) * bottom[i]).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function lightness(hex: Hex): number {
  const y = luminance(hex);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

interface Pair {
  name: string;
  fg: Hex;
  bg: Hex;
  min: number;
}

const SURFACES: PaletteToken[] = ['bg-sunken', 'bg-base', 'bg-surface', 'bg-elevated'];
const TEXT: PaletteToken[] = ['text-primary', 'text-secondary', 'text-muted', 'text-link', 'accent-primary',
  'accent-primary-hover', 'status-danger', 'status-success', 'status-warning', 'status-info'];
const CONTROLS: PaletteToken[] = ['border-control', 'accent-primary', 'status-danger', 'status-success', 'status-warning',
  'status-info'];
const RINGS: PaletteToken[] = ['seat-select', 'seat-attach', 'seat-doesnt-untap', 'accent-primary'];
const WHITE = '#FFFFFF';

function auditPairs(p: Palette): Pair[] {
  const pairs: Pair[] = [];
  const add = (fgName: string, fg: Hex, bgName: string, bg: Hex, min: number) =>
    pairs.push({ name: `${fgName} on ${bgName}`, fg, bg, min });
  const tint = (alpha: number, surface: PaletteToken) => composite(p['accent-primary'], alpha, p[surface]);

  for (const text of TEXT) {
    for (const surface of SURFACES) {
      add(text, p[text], surface, p[surface], 4.5);
    }
  }
  for (const text of ['text-primary', 'text-secondary', 'text-muted'] as PaletteToken[]) {
    add(text, p[text], 'table-felt', p['table-felt'], 4.5);
  }
  for (const text of ['text-primary', 'accent-primary', 'text-link', 'text-muted'] as PaletteToken[]) {
    add(text, p[text], 'accent-soft (chips, own chat bubble)', p['accent-soft'], 4.5);
  }
  for (const surface of ['bg-base', 'bg-surface', 'bg-elevated'] as PaletteToken[]) {
    add('accent-primary', p['accent-primary'], `accent/15 on ${surface} (active nav, selected rows)`, tint(0.15, surface), 4.5);
  }
  for (const surface of ['bg-surface', 'bg-elevated'] as PaletteToken[]) {
    add('text-primary', p['text-primary'], `accent/25 on ${surface} (selected rows)`, tint(0.25, surface), 4.5);
  }
  add('text-muted', p['text-muted'], 'accent/20 on bg-surface (selected game row)', tint(0.2, 'bg-surface'), 4.5);
  for (const status of ['status-danger', 'status-warning', 'status-success', 'status-info'] as PaletteToken[]) {
    const banner = composite(p[status], 0.1, p['bg-surface']);
    add(status, p[status], `${status}/10 on bg-surface (banners)`, banner, 4.5);
    add('text-primary', p['text-primary'], `${status}/10 on bg-surface (banners)`, banner, 4.5);
  }
  add('text-on-accent', p['text-on-accent'], 'accent-primary (primary buttons)', p['accent-primary'], 4.5);
  add('text-on-accent', p['text-on-accent'], 'accent-primary-hover', p['accent-primary-hover'], 4.5);
  add('white', WHITE, 'accent-secondary (secondary actions)', p['accent-secondary'], 4.5);
  add('text-on-accent', p['text-on-accent'], 'status-danger (danger buttons)', p['status-danger'], 4.5);
  add('text-on-accent', p['text-on-accent'], 'status-success', p['status-success'], 4.5);
  add('over-art-text', p['over-art-text'], 'over-art-backdrop (card pills)', p['over-art-backdrop'], 4.5);
  for (const surface of SURFACES) {
    add('text-disabled', p['text-disabled'], surface, p[surface], 3);
  }
  for (const control of CONTROLS) {
    for (const surface of SURFACES) {
      add(control, p[control], surface, p[surface], 3);
    }
  }
  add('border-control', p['border-control'], 'field fill (bg-sunken)', p['bg-sunken'], 3);
  for (const ring of RINGS) {
    for (const surface of ['table-felt', 'bg-surface'] as PaletteToken[]) {
      add(ring, p[ring], surface, p[surface], 3);
    }
  }
  return pairs;
}

const SRC = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(SRC, 'styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const BLOCKS = cssBlocks(css);
const SCHEMES: ColorScheme[] = ['dark', 'light'];
const THEMES = Object.values(ThemeName);
const PALETTE_CASES = THEMES.flatMap((name) => SCHEMES.map((scheme) => [name, scheme] as const));

function sourceLines(dir: string): string[][] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceLines(full);
    }
    return /\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name) ? [fs.readFileSync(full, 'utf8').split('\n')] : [];
  });
}
const SOURCES = sourceLines(SRC);

const selectionLabelBackdropAlpha = Number(
  /bg-over-art-backdrop\/(\d+)/.exec(fs.readFileSync(
    path.join(SRC, 'features/game/components/SelectionCount/SelectionCount.tsx'),
    'utf8',
  ))![1],
) / 100;

describe.each(PALETTE_CASES)('the %s %s palette', (name, scheme) => {
  const palette: Palette = PALETTES[name][scheme];

  test('matches styles/tokens.css token for token', () => {
    expect(BLOCKS.get(`:root[data-scheme='${name}'][data-theme='${scheme}']`)).toEqual(palette);
  });

  test.each(auditPairs(palette).map((pair) => [pair.name, pair] as const))('keeps %s at AA', (_, pair) => {
    expect(contrast(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
  });

  test('audits every pair the UI uses', () => {
    expect(auditPairs(palette)).toHaveLength(104);
  });

  test('keeps text on accent fills at AA when it is dimmed to 80% (counts and shortcut hints)', () => {
    for (const fill of ['accent-primary', 'accent-primary-hover'] as PaletteToken[]) {
      const dimmed = composite(palette['text-on-accent'], 0.8, palette[fill]);
      expect(contrast(dimmed, palette[fill]), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('keeps disabled text quieter than the muted hints people read', () => {
    for (const surface of SURFACES) {
      expect(contrast(palette['text-disabled'], palette[surface]), surface)
        .toBeLessThan(contrast(palette['text-muted'], palette[surface]));
    }
  });

  test('steps its surfaces far enough apart to tell them apart', () => {
    const step = (a: PaletteToken, b: PaletteToken) => Math.abs(lightness(palette[a]) - lightness(palette[b]));
    expect(step('bg-sunken', 'bg-base')).toBeGreaterThanOrEqual(3);
    expect(step('bg-base', 'bg-surface')).toBeGreaterThanOrEqual(5);
    expect(step('bg-surface', 'bg-elevated')).toBeGreaterThanOrEqual(4);
    expect(step('bg-base', 'table-felt')).toBeGreaterThanOrEqual(4);
    expect(contrast(palette['border-subtle'], palette['bg-surface'])).toBeGreaterThanOrEqual(1.4);
  });

  test('keeps the selection counts at AA on their translucent backdrop over the lightest art', () => {
    const backdrop = composite(palette['over-art-backdrop'], selectionLabelBackdropAlpha, WHITE);
    expect(contrast(palette['over-art-text'], backdrop)).toBeGreaterThanOrEqual(4.5);
  });

  test('keeps white labels on secondary actions at AA, including hover', () => {
    const actions = SOURCES.flat().filter((line) => line.includes('bg-accent-secondary') && line.includes('text-white'));
    expect(actions.length).toBeGreaterThanOrEqual(1);
    for (const action of actions) {
      for (const [, secondary, opacity] of action.matchAll(/(?:hover:)?bg-accent(-secondary)?(?:\/(\d+))?(?=\s)/g)) {
        const background = palette[secondary ? 'accent-secondary' : 'accent-primary'];
        const alpha = opacity ? Number(opacity) / 100 : 1;
        for (const surface of SURFACES) {
          const blended = composite(background, alpha, palette[surface]);
          expect(contrast(WHITE, blended), `on ${surface}: ${action.trim()}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

test('gives each theme its own accent but the same mana tints, life heart and life flashes', () => {
  const shared: PaletteToken[] = [
    'mana-w', 'mana-u', 'mana-b', 'mana-r', 'mana-g', 'mana-c', 'mana-o', 'over-art-life', 'seat-flash-gain', 'seat-flash-loss',
  ];
  const reference = PALETTES[ThemeName.Midnight].dark;
  for (const [name, scheme] of PALETTE_CASES) {
    for (const token of shared) {
      expect(PALETTES[name][scheme][token], `${name} ${scheme} ${token}`).toBe(reference[token]);
    }
  }
  const accents = new Set(PALETTE_CASES.map(([name, scheme]) => PALETTES[name][scheme]['accent-primary']));
  expect(accents.size).toBe(PALETTE_CASES.length);
});

test('a page without attributes gets the default theme, and data-theme alone picks its palette', () => {
  const defaults = PALETTES[PREFERENCE_DEFAULTS.themeName];
  expect(BLOCKS.get(':root')).toEqual(defaults.dark);
  expect(BLOCKS.get(':root[data-theme=\'dark\']')).toEqual(defaults.dark);
  expect(BLOCKS.get(':root[data-theme=\'light\']')).toEqual(defaults.light);
});

test('puts text on solid accent fills in text-on-accent, never white', () => {
  const solidAccent = /(^|[\s'"`])(hover:)?bg-accent(-hover)?(?=[\s'"`])/;
  const offenders = SOURCES.flatMap((lines) => lines.filter((line, index) =>
    /\btext-white\b/.test(line) && solidAccent.test(lines.slice(Math.max(0, index - 3), index + 4).join(' '))));
  expect(offenders).toEqual([]);
});

test('draws form-control edges at full strength, since a translucent edge drops below 3:1', () => {
  const offenders = SOURCES.flat().filter((line) => /\b(border|ring)-border-control\/\d+/.test(line));
  expect(offenders).toEqual([]);
});
