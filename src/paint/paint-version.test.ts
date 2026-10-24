import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computePaintVersion, paintSources, relativeImports } from './paint-version';

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'paint-version-'));
  dirs.push(root);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

const roots = ['src/paint', 'src/scene'];
const tree = {
  'src/paint/wet.ts': "import { rng } from '../core/rng';\nexport const wet = rng;",
  'src/paint/wet.test.ts': "import { wet } from './wet';",
  'src/paint/paint.studio.ts': "import { menu } from '../ui/menu';",
  'src/scene/sky.ts': "import { edge } from '../ui/stage-edge';\nimport './side-effect';\nconst W = () => new Worker(new URL('./worker.ts', import.meta.url));",
  'src/scene/side-effect.ts': '',
  'src/scene/worker.ts': "const lazy = () => import('../core/lazy');",
  'src/core/rng.ts': 'export const rng = 1;',
  'src/core/lazy.ts': "export * from './deep/index';",
  'src/core/deep/index.ts': 'export const deep = 1;',
  'src/core/state.ts': 'export const state = 1;',
  'src/ui/stage-edge.ts': "import { noise } from '../paint/noise-free';\nexport const edge = 1;",
  'src/ui/menu.ts': 'export const menu = 1;',
};

describe('paint version', () => {
  it('reads every kind of relative import', () => {
    const src = [
      "import { a } from './a';",
      "import type { B } from '../b/b';",
      "import './c';",
      "export * from './d';",
      "const e = await import('./e');",
      "new Worker(new URL('./f.ts', import.meta.url), { type: 'module' });",
      "const g = import.meta.glob<{ x: 1 }>('../g/g.ts', { eager: true });",
      "const h = import.meta.glob('./species/*.ts');",
      "import { createHash } from 'node:crypto';",
      "import W from './w?worker';",
    ].join('\n');
    expect(relativeImports(src).sort()).toEqual(['../b/b', '../g/g.ts', './a', './c', './d', './e', './f.ts', './w'].sort());
  });

  it('hashes the paint directories and everything they import, without tests and studio entries', () => {
    const root = project(tree);
    expect(paintSources(root, roots)).toEqual([
      'src/core/deep/index.ts',
      'src/core/lazy.ts',
      'src/core/rng.ts',
      'src/paint/wet.ts',
      'src/scene/side-effect.ts',
      'src/scene/sky.ts',
      'src/scene/worker.ts',
      'src/ui/stage-edge.ts',
    ]);
  });

  it('changes when any hashed file changes, and only then', () => {
    const root = project(tree);
    const v0 = computePaintVersion(root, roots);
    expect(v0).toMatch(/^[0-9a-f]{12}$/);
    expect(computePaintVersion(root, roots)).toBe(v0);

    writeFileSync(join(root, 'src/paint/wet.test.ts'), '// a new test');
    writeFileSync(join(root, 'src/paint/paint.studio.ts'), '// a new studio entry');
    writeFileSync(join(root, 'src/core/state.ts'), '// not imported by a painter');
    writeFileSync(join(root, 'src/ui/menu.ts'), '// only a studio entry imports it');
    expect(computePaintVersion(root, roots)).toBe(v0);

    for (const file of ['src/paint/wet.ts', 'src/core/rng.ts', 'src/ui/stage-edge.ts', 'src/core/deep/index.ts']) {
      writeFileSync(join(root, file), `// changed ${file}`);
      const v = computePaintVersion(root, roots);
      expect(v, file).not.toBe(v0);
    }
  });

  it('a new file under a paint directory changes it', () => {
    const root = project(tree);
    const v0 = computePaintVersion(root, roots);
    writeFileSync(join(root, 'src/scene/new-step.ts'), 'export const step = 1;');
    expect(computePaintVersion(root, roots)).not.toBe(v0);
  });

  it("covers this project's painters and what they import from elsewhere", () => {
    const root = resolve(import.meta.dirname, '../..');
    const files = paintSources(root);
    for (const f of ['src/paint/wet.ts', 'src/paint/persist.ts', 'src/scene/background.ts', 'src/plants/sprite-worker.ts', 'src/ambience/lighting.ts', 'src/core/rng.ts', 'src/dev/fixture-species.ts']) {
      expect(files, f).toContain(f);
    }
    expect(files.some((f) => /\.(test|studio)\.ts$/.test(f))).toBe(false);
    expect(files.some((f) => f.startsWith('src/plants/species/'))).toBe(true);
    expect(files.some((f) => f.startsWith('src/ui/') || f.startsWith('src/studio/'))).toBe(false);
  });
});
