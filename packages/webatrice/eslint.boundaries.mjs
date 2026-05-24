import boundaries from 'eslint-plugin-boundaries';

const elements = [
  { type: 'components', pattern: ['src/components/**'] },
  { type: 'dialogs', pattern: ['src/dialogs/**'] },
  { type: 'feature-widgets', pattern: ['src/feature-widgets/**'] },
  { type: 'feature-wrappers', pattern: ['src/feature-wrappers/**'] },
  { type: 'features', pattern: ['src/features/**'] },
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
  // and LeftNav). They compose feature-widgets for top-level affordances (e.g. card-import
  // dialog accessible from any page) and are consumed by features (below) for wrapping
  // their route content.
  {
    from: { type: 'feature-wrappers' },
    allow: types('components', 'dialogs', 'feature-widgets', 'hooks', 'images', 'services', 'store', 'types', 'utils')
  },

  // Features are vertical slices: they pull from root-level shared assets but nothing
  // pulls from them except the root AppShell. Features may import other features only
  // implicitly via the containers that compose them. Features may also compose
  // feature-widgets (one-way: features → feature-widgets, never the reverse). Features
  // also pull from `feature-wrappers` for the page chrome (Layout, etc.).
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
    files: ['**/*.spec.*'],
    rules: { 'boundaries/dependencies': 'off' },
  },
];
