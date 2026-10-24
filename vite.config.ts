import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { fontPreloadHrefs } from './src/build/font-preload.ts';
import { buildPrecacheManifest, describeBundle, injectPrecache, type OutputFileLike } from './src/build/sw-manifest.ts';
import { computePaintVersion } from './src/paint/paint-version.ts';

const root = import.meta.dirname;

/**
 * Writes the precache manifest and its version into the built `sw.js` (ADR 0229,
 * src/build/sw-manifest.ts). Production builds only: the dev server serves `public/sw.js` as it
 * is, with an empty list and version 'dev'.
 */
function swManifest(): Plugin {
  let base = '/';
  return {
    name: 'sprout:sw-manifest',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    writeBundle(options, bundle) {
      const sw = join(options.dir ?? resolve(root, 'dist'), 'sw.js');
      const files = describeBundle(bundle as unknown as Record<string, OutputFileLike>);
      writeFileSync(sw, injectPrecache(readFileSync(sw, 'utf8'), buildPrecacheManifest(files, { base })));
    },
  };
}

/**
 * Preloads the first view's three fonts from the built `index.html` (ADR 0231,
 * src/build/font-preload.ts), so they load with the HTML's own requests instead of after the JS has
 * built the dock. The hashed names come from the bundle. Production builds only, and not the studio.
 */
function fontPreload(): Plugin {
  let base = '/';
  return {
    name: 'sprout:font-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle || !ctx.filename.endsWith('/index.html')) return;
        const assets = Object.values(ctx.bundle).filter((f) => f.type === 'asset');
        return fontPreloadHrefs(assets, base).map((href) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href },
          injectTo: 'head',
        }));
      },
    },
  };
}

// GitHub Pages serves the site from https://<user>.github.io/Ssprout/
export default defineConfig(({ command }) => ({
  base: '/Ssprout/',
  plugins: [swManifest(), fontPreload()],
  define: {
    // A hash of every source that affects painted pixels, keying the persistent paint cache
    // (src/paint/persist.ts, ADR 0227). The dev server and Vitest get 'dev', which turns the
    // cache off: their sources change without a rebuild.
    __PAINT_VERSION__: JSON.stringify(command === 'build' ? computePaintVersion(root) : 'dev'),
  },
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
    // A few tests simulate hours of garden time or paint every species step by step; they take
    // 1–4 s on an idle laptop and several times that when other agents load the machine.
    // A generous ceiling keeps a slow machine from failing them (docs/TESTING.md).
    testTimeout: 20_000,
    // CPU budget on the owner's laptop (docs/TESTING.md): locally at most 3 test workers
    // instead of one per core; CI keeps the default.
    maxWorkers: process.env.CI ? undefined : Number(process.env.VITEST_WORKERS ?? 3),
    // DOM tests opt in per file with: // @vitest-environment jsdom
  },
}));
