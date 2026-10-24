import boundaries from 'eslint-plugin-boundaries';

const elements = [
  { type: 'components', pattern: ['src/components/**'] },
  { type: 'dialogs', pattern: ['src/dialogs/**'] },
  { type: 'feature-widgets', pattern: ['src/feature-widgets/**'] },
  { type: 'feature-wrappers', pattern: ['src/feature-wrappers/**'] },
  { type: 'features', pattern: ['src/features/*'], capture: ['feature'] },
  { type: 'hooks', pattern: ['src/hooks/**'] },
  { type: 'images', pattern: ['src/images/**'] },
  { type: 'services', pattern: ['src/services/**'] },
  { type: 'store', pattern: ['src/store/**'] },
  { type: 'types', pattern: ['src/types/**'] },
  { type: 'utils', pattern: ['src/utils/**'] },
];

const types = (...types) => types.map((type) => ({ to: { type } }));

const rules = [
  { from: { type: 'types' }, allow: [] },
  { from: { type: 'images' }, allow: types('types') },
  { from: { type: 'utils' }, allow: types('types') },

  { from: { type: 'store' }, allow: types('types', 'utils') },

  { from: { type: 'services' }, allow: types('store', 'types', 'utils') },
  { from: { type: 'hooks' }, allow: types('services', 'store', 'types', 'utils') },
  { from: { type: 'dialogs' }, allow: types('hooks', 'services', 'store', 'types', 'utils') },

  {
    from: { type: 'components' },
    allow: types('dialogs', 'hooks', 'images', 'services', 'store', 'types', 'utils')
  },

  // Feature-widgets are multi-file capabilities composed by ≥2 features. They pull
  // from root-level shared assets but explicitly NOT from features or other
  // feature-widgets (enforces one-way + no-cross-widget-imports).
  {
    from: { type: 'feature-widgets' },
    allow: types('components', 'dialogs', 'hooks', 'images', 'services', 'store', 'types', 'utils')
  },

  // Feature-wrappers are page-chrome wrappers (currently just `layout/`, holding Layout
  // and TopBar). They compose feature-widgets for top-level affordances (e.g.
  // card-import dialog accessible from any page) and are consumed by features (below) for
  // wrapping their route content. Module-level feature caches register their own
  // cleanup with services/session; AppShell hosts the session boundary.
  {
    from: { type: 'feature-wrappers' },
    allow: types('components', 'dialogs', 'feature-widgets', 'hooks', 'images', 'services', 'store', 'types', 'utils')
  },

  // Features are vertical slices: they pull from root-level shared assets but nothing
  // pulls from them except the root AppShell. Each feature folder is its own element,
  // so imports inside a feature are internal and imports between features are errors —
  // shared capabilities move to a root owner instead. Features may also compose
  // feature-widgets (one-way: features → feature-widgets, never the reverse) and pull
  // from `feature-wrappers` for the page chrome (Layout, etc.).
  {
    from: { type: 'features' },
    allow: types('components', 'dialogs', 'feature-widgets', 'hooks', 'images', 'services', 'feature-wrappers', 'store', 'types', 'utils')
  },
];

export const boundariesConfig = [
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        rules,
      }],
    },
  },
  {
    files: ['**/*.spec.*', 'integration/**'],
    rules: { 'boundaries/dependencies': 'off' },
  },
];
