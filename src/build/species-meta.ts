import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Species metadata for the main thread (ADR 0348). `src/plants/registry.ts` imports every species
 * as `<id>.ts?meta`. A production build answers with the species' definition minus `draw`, as
 * JSON, so no painter code reaches the first view; the dev server and Vitest re-export the
 * full module.
 */

/** A definition without its painter, as plain data (what the main thread's `?meta` module exports). */
export function speciesMeta(def: Record<string, unknown>): Record<string, unknown> {
  const { draw: _draw, ...meta } = def;
  return JSON.parse(JSON.stringify(meta)) as Record<string, unknown>;
}

const speciesFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.studio.ts'));

/** Bundle every species of `dir` with esbuild, run it in Node and return each one's metadata by id. */
export async function extractSpeciesMeta(dir: string): Promise<Map<string, Record<string, unknown>>> {
  const { build } = await import('esbuild');
  const files = speciesFiles(dir);
  const contents = `${files.map((f, i) => `import s${i} from './${f}';`).join('\n')}\nexport default [${files.map((_, i) => `s${i}`).join(', ')}];`;
  const out = await build({
    stdin: { contents, resolveDir: dir, loader: 'ts', sourcefile: 'species-meta-entry.ts' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    define: { __PAINT_VERSION__: '"species-meta"' },
    logLevel: 'silent',
  });
  const tmp = mkdtempSync(join(tmpdir(), 'species-meta-'));
  try {
    const file = join(tmp, 'species.mjs');
    writeFileSync(file, out.outputFiles[0]!.text);
    const mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { default: Record<string, unknown>[] };
    const map = new Map<string, Record<string, unknown>>();
    mod.default.forEach((def, i) => {
      const id = basename(files[i]!, '.ts');
      if (def?.id !== id) throw new Error(`species-meta: ${files[i]} exports id "${String(def?.id)}"`);
      map.set(id, speciesMeta(def));
    });
    return map;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function speciesMetaPlugin(): Plugin {
  let isBuild = false;
  let metas: Promise<Map<string, Record<string, unknown>>> | null = null;
  return {
    name: 'sprout:species-meta',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    async load(id) {
      const [file, query] = id.split('?');
      if (query !== 'meta' || !file || !/\/plants\/species\/[^/]+\.ts$/.test(file)) return null;
      const name = basename(file, '.ts');
      if (!isBuild) return `export { default } from './${name}.ts';`;
      metas ??= extractSpeciesMeta(dirname(file));
      const meta = (await metas).get(name);
      if (!meta) throw new Error(`species-meta: no species "${name}"`);
      return `export default ${JSON.stringify(meta)};`;
    },
  };
}
