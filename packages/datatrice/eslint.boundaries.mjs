import boundaries from 'eslint-plugin-boundaries';

const elements = [
  { type: 'api', pattern: ['src/api/**'] },
  { type: 'react', pattern: ['src/react/**'] },
  { type: 'slice', pattern: ['src/store/**'] },
  { type: 'common', pattern: ['src/common/**'] },
  { type: 'types', pattern: ['src/types/**'] },
  { type: 'integration', pattern: ['src/integration/**'] },
  { type: 'testing', pattern: ['src/testing/**'] },
  { type: 'root', pattern: ['src/*.ts'], mode: 'file' },
];

const types = (...types) => types.map((type) => ({ to: { type } }));

const rules = [
  { from: { type: 'common' }, allow: types('common', 'types') },
  { from: { type: 'types' }, allow: types('types') },
  { from: { type: 'slice' }, allow: types('common', 'types', 'slice') },
  { from: { type: 'api' }, allow: types('common', 'types', 'slice', 'api', 'root') },
  { from: { type: 'react' }, allow: types('common', 'types', 'slice', 'api', 'root') },
  { from: { type: 'root' }, allow: types('common', 'types', 'slice', 'api', 'root') },
  // integration tests compose the whole stack — they're allowed to import from
  // every other layer (and themselves for shared helpers).
  { from: { type: 'integration' }, allow: types('common', 'types', 'slice', 'api', 'react', 'root', 'integration') },
  // testing surface ships state-shape fixtures; reaches into types and the
  // slice-state interfaces it constructs.
  { from: { type: 'testing' }, allow: types('common', 'types', 'slice', 'testing') },
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
