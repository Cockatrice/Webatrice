import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = (...segments: string[]) => path.resolve(__dirname, 'src', ...segments);

// Unit test suite (`npm run test` / `test:coverage`).
//
// Purpose: fast, isolated tests of components, hooks, and utilities in jsdom.
// Specs live next to their source as `src/**/*.spec.{ts,tsx}`.
//
// Boundary: every external boundary is mocked — WebSocket and Dexie/IndexedDB
// are stubbed in `src/setupTests.ts`; there is no real network, no real
// browser, no real server. Tests that need a real Redux store + Datatrice
// reducers + protobuf round-trips belong in the integration suite
// (`vitest.integration.config.ts`); tests that need a real browser against a
// real Servatrice belong in the e2e suite (`playwright.config.ts`).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app/components': srcPath('components/index.ts'),
      '@app/dialogs': srcPath('dialogs/index.ts'),
      '@app/hooks': srcPath('hooks/index.ts'),
      '@app/images': srcPath('images/index.ts'),
      '@app/services': srcPath('services/index.ts'),
      '@app/feature-wrappers/layout': srcPath('feature-wrappers/layout/index.ts'),
      '@app/features/account': srcPath('features/account/index.ts'),
      '@app/features/decks': srcPath('features/decks/index.ts'),
      '@app/features/game': srcPath('features/game/index.ts'),
      '@app/features/logs': srcPath('features/logs/index.ts'),
      '@app/features/login': srcPath('features/login/index.ts'),
      '@app/features/player': srcPath('features/player/index.ts'),
      '@app/features/rooms': srcPath('features/rooms/index.ts'),
      '@app/features/server': srcPath('features/server/index.ts'),
      '@app/features/settings': srcPath('features/settings/index.ts'),
      '@app/features/shell': srcPath('features/shell/index.ts'),
      '@app/feature-widgets/card-import': srcPath('feature-widgets/card-import/index.ts'),
      '@app/feature-widgets/known-hosts': srcPath('feature-widgets/known-hosts/index.ts'),
      '@app/feature-widgets/shortcuts': srcPath('feature-widgets/shortcuts/index.ts'),
      '@app/store': srcPath('store/index.ts'),
      '@app/types': srcPath('types/index.ts'),
      '@app/utils': srcPath('utils/index.ts'),
    },
  },
  optimizeDeps: {
    include: [
      '@mui/material',
      '@mui/material/styles',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      '@dnd-kit/core',
      '@dnd-kit/utilities',
      '@reduxjs/toolkit',
      'react-redux',
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react-router-dom',
      'i18next',
      'react-i18next',
      '@testing-library/react',
      '@testing-library/jest-dom/vitest',
      '@bufbuild/protobuf',
      '@cockatrice/sockatrice',
      '@cockatrice/sockatrice/types',
      '@cockatrice/sockatrice/generated',
      '@cockatrice/datatrice',
      '@cockatrice/datatrice/react',
      '@cockatrice/datatrice/types',
    ],
  },
  publicDir: 'public',
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        // Split heavy, stable third-party libraries out of the entry chunk so
        // it stays under the 500 kB warning limit and vendor code caches across
        // deploys. Order matters: more specific matches come first (e.g.
        // react-i18next is matched by i18n before the generic react bucket).
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('@mui') || id.includes('@emotion')) {
            return 'vendor-mui';
          }
          if (id.includes('@dnd-kit')) {
            return 'vendor-dnd';
          }
          if (id.includes('i18next')) {
            return 'vendor-i18n';
          }
          if (id.includes('@bufbuild') || id.includes('@cockatrice')) {
            return 'vendor-cockatrice';
          }
          if (id.includes('redux') || id.includes('/react') || id.includes('react-')) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
  server: {
    open: true,
    watch: {
      ignored: ['build', 'coverage', 'integration']
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Both sockatrice and datatrice now ship self-contained tsup builds
    // (explicit `.js` extensions on every internal import), so vitest's
    // node-side resolver handles them directly — no `deps.inline`
    // workaround needed.
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    exclude: ['node_modules', 'build', 'integration', 'coverage'],
    isolate: true,
    pool: 'vmThreads',
    maxWorkers: '75%',
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage/testing',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/__mocks__/**',
        'src/__test-utils__/**',
        'src/setupTests.ts',
        'src/polyfills.ts',
      ],
      // Cross-repo unit-suite floor at 75/75/75/70 (Webatrice). Cross-repo
      // target is 95/95/95/90; this is a deliberate ratchet point en route.
      // Per-feature gates land at the same 75/75/75/70 floor so a regression
      // in any single feature flips CI red even if the aggregate stays above
      // the project floor. Ratchet up only — never relax a gate.
      thresholds: {
        statements: 75,
        functions: 75,
        lines: 75,
        branches: 70,
        'src/features/account/**':  { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/decks/**':    { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/game/**':     { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/login/**':    { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/logs/**':     { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/player/**':   { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/rooms/**':    { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/server/**':   { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/settings/**': { statements: 75, functions: 75, lines: 75, branches: 70 },
        'src/features/shell/**':    { statements: 75, functions: 75, lines: 75, branches: 70 },
      },
    },
  },
});
