import { defineConfig } from 'tsup';

// Four public entry points matching the package.json `exports` map:
//   `datatrice` → ./dist/index.js
//   `datatrice/react` → ./dist/react/index.js
//   `datatrice/types` → ./dist/types/index.js
//   `datatrice/testing` → ./dist/testing/index.js (redux state-shape fixtures)
//
// `splitting: true` (the ESM default) hoists shared internal modules
// (slice reducers, listener registrations, response impls, etc.) into
// chunk files alongside the entries. Each chunk import in the emitted
// .js is written with an explicit `.js` extension, which is what makes
// the package resolvable under native Node ESM without bundler help.
// That's the whole reason this config replaces the previous raw `tsc`
// build (see plan §Phase 7).
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
    'types/index': 'src/types/index.ts',
    'testing/index': 'src/testing/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  outDir: 'dist',
  external: [
    '@reduxjs/toolkit',
    '@bufbuild/protobuf',
    'react',
    'react-redux',
    '@cockatrice/sockatrice',
    '@cockatrice/sockatrice/types',
    '@cockatrice/sockatrice/generated',
  ],
});
