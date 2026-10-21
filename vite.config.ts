import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

// GitHub Pages serves the site from https://<user>.github.io/Ssprout/
export default defineConfig({
  base: '/Ssprout/',
  build: {
    target: 'es2022',
    sourcemap: true,
    // multi-page: the garden app and the studio (visual review of every sprite/animation)
    rolldownOptions: {
      input: {
        main: resolve(root, 'index.html'),
        studio: resolve(root, 'studio.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The fs module cache does not invalidate import.meta.glob results when new files are
    // added (e.g. a new species), which made the registry miss species (ADR 0004).
    fsModuleCache: false,
    // DOM tests opt in per file with: // @vitest-environment jsdom
  },
});
