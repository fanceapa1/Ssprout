import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from https://<user>.github.io/Ssprout/
export default defineConfig({
  base: '/Ssprout/',
  build: {
    target: 'es2022',
    sourcemap: true,
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
    // DOM tests opt in per file with: // @vitest-environment jsdom
  },
});
