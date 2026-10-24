/**
 * The paint version (ADR 0227): a hash of every source file that can change painted pixels.
 *
 * BUILD-TIME ONLY (Node): imported by `vite.config.ts`, which injects the result as
 * `__PAINT_VERSION__` (see `persist.ts`). App code never imports this module.
 *
 * The hashed set is the *import closure* of the painting directories (`PAINT_ROOTS`): every
 * `.ts` file under them (tests and studio entries left out), plus every file they import,
 * transitively, wherever it lives (today `src/dev/debug.ts` and `src/dev/fixture-species.ts`). A new import
 * from a painter is therefore covered without anyone editing a list. The roots err on the side of
 * more: a needless change costs one repaint per visitor after a deploy, a missed one shows stale
 * art.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/** Directories (relative to the project root) whose code decides what a painting looks like. */
export const PAINT_ROOTS: readonly string[] = [
  'src/paint', // the engine, the paper, this cache's own format
  'src/scene', // the landscape, sky plates, scene sprites
  'src/ambience', // daylight, light plates, weather sprites
  'src/plants', // species painters and their lib, sprite cache, the plant view
  'src/fauna', // creature sprites
  'src/render', // viewport, camera, layer composition
  'src/core', // seeded Rng, state shapes the painters read
];

/** Files that never reach a painting: unit tests and studio entries. */
export function isPaintSource(path: string): boolean {
  return /\.ts$/.test(path) && !/\.(test|studio)\.ts$/.test(path) && !path.endsWith('.d.ts');
}

function listTs(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listTs(p, out);
    else if (isPaintSource(p)) out.push(p);
  }
}

/** Relative module specifiers a file imports (static, dynamic, side-effect, worker URLs, globs without wildcards). */
export function relativeImports(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
    /\bnew\s+URL\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\.meta\.glob(?:<[^>]*>)?\s*\(\s*['"](\.{1,2}\/[^'"*]+)['"]/g,
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) found.add(m[1]!.replace(/\?.*$/, ''));
  return [...found];
}

function resolveImport(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile() && candidate.endsWith('.ts')) return candidate;
  }
  return null;
}

/** Every file the paint version hashes, as sorted root-relative paths with `/` separators. */
export function paintSources(root: string, roots: readonly string[] = PAINT_ROOTS): string[] {
  const start: string[] = [];
  for (const r of roots) {
    const dir = resolve(root, r);
    if (existsSync(dir)) listTs(dir, start);
  }
  const seen = new Set<string>();
  const queue = [...start];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of relativeImports(readFileSync(file, 'utf8'))) {
      const dep = resolveImport(file, spec);
      if (dep && isPaintSource(dep) && !seen.has(dep)) queue.push(dep);
    }
  }
  return [...seen].map((f) => relative(root, f).split(sep).join('/')).sort();
}

/** The paint version: the first 12 hex digits of a SHA-256 over every paint source's path and bytes. */
export function computePaintVersion(root: string, roots: readonly string[] = PAINT_ROOTS): string {
  const hash = createHash('sha256');
  for (const file of paintSources(root, roots)) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(join(root, file)));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}
