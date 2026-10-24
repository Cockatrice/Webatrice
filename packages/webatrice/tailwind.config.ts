import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

type FontSizeOptions = string | { lineHeight?: string; letterSpacing?: string; fontWeight?: string };
type FontSizeValue = string | [string, FontSizeOptions];

const ABSOLUTE_LENGTH = /^-?\d*\.?\d+(px|rem)$/;

const scaled = (value: string): string => (ABSOLUTE_LENGTH.test(value) ? `calc(${value} * var(--fs-scale, 1))` : value);

const fontSizeRule = (value: FontSizeValue, modifier: string | null) => {
  const [fontSize, options] = Array.isArray(value) ? value : [value];
  if (modifier) {
    return { 'font-size': scaled(fontSize), 'line-height': scaled(modifier) };
  }
  const { lineHeight, letterSpacing, fontWeight } = typeof options === 'object' ? options : { lineHeight: options };
  return {
    'font-size': scaled(fontSize),
    ...(lineHeight === undefined ? {} : { 'line-height': scaled(lineHeight) }),
    ...(letterSpacing === undefined ? {} : { 'letter-spacing': letterSpacing }),
    ...(fontWeight === undefined ? {} : { 'font-weight': fontWeight }),
  };
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        modern: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: { ui: 'var(--radius)', 'ui-sm': 'var(--radius-sm)', 'ui-lg': 'var(--radius-lg)' },
      spacing: { row: 'var(--row-h)', pad: 'var(--pad)', gap: 'var(--gap)' },
      fontSize: { ui: ['var(--fs-ui)', 'var(--lh-ui)'], 'ui-sm': ['var(--fs-ui-sm)', '1.35'] },
      colors: {
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          sunken: 'rgb(var(--bg-sunken) / <alpha-value>)',
        },
        border: {
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
          control: 'rgb(var(--border-control) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-primary) / <alpha-value>)',
          hover: 'rgb(var(--accent-primary-hover) / <alpha-value>)',
          secondary: 'rgb(var(--accent-secondary) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          disabled: 'rgb(var(--text-disabled) / <alpha-value>)',
          link: 'rgb(var(--text-link) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--text-on-accent) / <alpha-value>)',
        danger: 'rgb(var(--status-danger) / <alpha-value>)',
        success: 'rgb(var(--status-success) / <alpha-value>)',
        warning: 'rgb(var(--status-warning) / <alpha-value>)',
        info: 'rgb(var(--status-info) / <alpha-value>)',
        table: {
          felt: 'rgb(var(--table-felt) / <alpha-value>)',
          rim: 'rgb(var(--table-rim) / <alpha-value>)',
        },
        mana: {
          w: 'rgb(var(--mana-w) / <alpha-value>)',
          u: 'rgb(var(--mana-u) / <alpha-value>)',
          b: 'rgb(var(--mana-b) / <alpha-value>)',
          r: 'rgb(var(--mana-r) / <alpha-value>)',
          g: 'rgb(var(--mana-g) / <alpha-value>)',
          c: 'rgb(var(--mana-c) / <alpha-value>)',
          o: 'rgb(var(--mana-o) / <alpha-value>)',
        },
        seat: {
          select: 'rgb(var(--seat-select) / <alpha-value>)',
          attach: 'rgb(var(--seat-attach) / <alpha-value>)',
          'doesnt-untap': 'rgb(var(--seat-doesnt-untap) / <alpha-value>)',
        },
        'over-art': {
          text: 'rgb(var(--over-art-text) / <alpha-value>)',
          backdrop: 'rgb(var(--over-art-backdrop) / <alpha-value>)',
          life: 'rgb(var(--over-art-life) / <alpha-value>)',
        },
        'pt-modified': 'rgb(var(--pt-modified) / <alpha-value>)',
      },
      boxShadow: {
        glow: '0 0 24px -4px rgb(var(--accent-primary) / 0.35)',
        pop: 'var(--shadow-pop)',
        panel: 'var(--shadow-panel)',
      },
      backgroundImage: {
        'purple-radial':
          'radial-gradient(ellipse at top, rgb(var(--accent-secondary) / 0.18), transparent 60%)',
      },
    },
  },
  corePlugins: { fontSize: false, lineHeight: false },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('light', ':root[data-theme="light"] &');
    }),
    plugin(({ matchUtilities, theme }) => {
      matchUtilities<FontSizeValue>(
        { text: (value, { modifier }) => fontSizeRule(value, modifier) },
        {
          values: theme('fontSize'),
          modifiers: theme('lineHeight'),
          type: ['absolute-size', 'relative-size', 'length', 'percentage'],
        },
      );
      matchUtilities({ leading: (value: string) => ({ 'line-height': value }) }, { values: theme('lineHeight') });
    }),
  ],
} satisfies Config;
