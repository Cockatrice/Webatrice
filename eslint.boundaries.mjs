import boundaries from 'eslint-plugin-boundaries';

const elements = [
  { type: 'generated', pattern: ['src/generated/**'] },
  { type: 'lib', pattern: ['src/**'], mode: 'folder' },
];

const types = (...types) => types.map((type) => ({ to: { type } }));

const rules = [
  { from: { type: 'generated' }, allow: [] },
  { from: { type: 'lib' }, allow: types('generated', 'lib') },
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
