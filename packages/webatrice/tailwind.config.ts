import type { Config } from 'tailwindcss';

/** Preflight is on: MUI's CssBaseline was removed alongside the theme,
 *  so preflight now provides the button/anchor/heading/box-sizing
 *  reset for the whole app. Matches fancy webatrice's setup exactly.
 *  Tokens mirror fancy webatrice's palette — colors are stored as
 *  space-separated RGB channels so <alpha-value> works:
 *  rgb(var(--x) / 0.5). See src/styles/tokens.css. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'serif'],
        modern: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        },
        border: {
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-primary) / <alpha-value>)',
          hover: 'rgb(var(--accent-primary-hover) / <alpha-value>)',
          secondary: 'rgb(var(--accent-secondary) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
      },
      boxShadow: {
        glow: '0 0 24px -4px rgb(var(--accent-primary) / 0.35)',
      },
      backgroundImage: {
        'purple-radial':
          'radial-gradient(ellipse at top, rgb(var(--accent-secondary) / 0.18), transparent 60%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
