import { defineConfig } from 'tsup';

// Five public entry points matching the package.json `exports` map:
//   `sockatrice` → ./dist/index.js
//   `sockatrice/generated` → ./dist/generated/index.js (proto-generated)
//   `sockatrice/types` → ./dist/types/index.js
//   `sockatrice/testing` → ./dist/testing/index.js (proto builders + mock-WS helpers)
//   `sockatrice/testing/setup-hooks` → ./dist/testing/setup-hooks.js (vitest setupFile)
//
// Previously the build was raw `tsc -p tsconfig.build.json`, which emitted
// extensionless relative imports inside e.g. `dist/generated/index.js`
// (`export * from './proto/admin_commands_pb'`). Native Node ESM cannot
// resolve those, which forced every consumer (Datatrice, Webatrice) to
// inline the package through its bundler. tsup bundles the output and
// writes `.js` extensions on every chunk import, making the package
// resolvable from raw Node and freeing consumers from the inline
// workaround.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'generated/index': 'src/generated/index.ts',
    'types/index': 'src/types/index.ts',
    'testing/index': 'src/testing/index.ts',
    'testing/setup-hooks': 'src/testing/setup-hooks.ts',
    // KeepAliveService.ts spawns the worker via
    //   new Worker(new URL('./keepAliveWorker.js', import.meta.url))
    // and the URL is resolved relative to whichever chunk file
    // KeepAliveService ends up bundled into. Emit the worker at the
    // top of dist/ (not under dist/services/) so the relative URL
    // resolves regardless of the chunk path.
    keepAliveWorker: 'src/services/keepAliveWorker.ts',
  },
  format: ['esm'],
  // `dts: false` because rollup-plugin-dts (tsup's built-in dts engine)
  // collapses `export * as WebsocketTypes from './namespace'` into a
  // `declare const namespace_X: typeof X` pattern that makes every
  // member resolve as a value at type position. Consumers then hit
  // TS2749 when they reference e.g. `WebsocketTypes.IWebClientResponse`
  // as a type. Declarations are emitted by tsc instead (see the
  // `build` script in package.json) which preserves namespace
  // re-exports verbatim.
  dts: false,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  outDir: 'dist',
  external: [
    '@bufbuild/protobuf',
    'dompurify',
    'vitest',
  ],
});
