import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = (...segments: string[]) => path.resolve(__dirname, 'src', ...segments);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app/api': srcPath('api/index.ts'),
      '@app/components': srcPath('components/index.ts'),
      '@app/dialogs': srcPath('dialogs/index.ts'),
      '@app/hooks': srcPath('hooks/index.ts'),
      '@app/images': srcPath('images/index.ts'),
      '@app/services': srcPath('services/index.ts'),
      '@app/feature-core': srcPath('feature-core/index.ts'),
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
      '@app/websocket/types': 'sockatrice/types',
      '@app/websocket': 'sockatrice',
      '@app/generated': 'sockatrice/generated',
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
      'sockatrice',
      'sockatrice/types',
      'sockatrice/generated',
    ],
  },
  publicDir: 'public',
  build: {
    outDir: 'build',
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
    server: {
      deps: {
        inline: ['sockatrice'],
      },
    },
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    exclude: ['node_modules', 'build', 'integration', 'coverage'],
    isolate: true,
    pool: 'forks',
    maxWorkers: 4,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage/testing',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/__mocks__/**',
        'src/setupTests.ts',
        'src/polyfills.ts',
      ],
    },
  },
});
