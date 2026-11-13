import { describe, expect, it } from 'vitest';
import { faunaTable } from '../../scenery/fauna';
import type { CreatureDef } from './lib/def';
import { creatureDef, creatureDefs, creatureGardens, creatureKinds, creaturesLoaded, kindFromPath, loadAllCreatures, loadCreatures, setIdFromPath } from './registry';

const modules = import.meta.glob<{ default: CreatureDef }>(['./*.ts', '!./registry.ts', '!./*.test.ts', '!./*.studio.ts'], { eager: true });
const sets = import.meta.glob<{ default: readonly CreatureDef[] }>('./sets/creatures-*.ts', { eager: true });
const MODULE_KINDS = Object.keys(modules).map(kindFromPath).sort();

describe('creature registry', () => {
  it('every creature module default-exports a def that names its own file', () => {
    expect(MODULE_KINDS.length).toBeGreaterThanOrEqual(10);
    for (const [path, m] of Object.entries(modules)) expect(m.default?.kind, path).toBe(kindFromPath(path));
  });

  it("each garden's set is exactly the kinds of its table that have a module, and the sets cover every module", () => {
    expect(creatureGardens().sort()).toEqual(['coast', 'japanese-garden', 'oasis', 'waterfall']);
    const covered = new Set<string>();
    for (const [path, m] of Object.entries(sets)) {
      const id = setIdFromPath(path) as Parameters<typeof faunaTable>[0];
      const want = [...new Set(faunaTable(id).map((r) => r.kind))].filter((k) => MODULE_KINDS.includes(k)).sort();
      const kinds = m.default.map((d) => d.kind);
      expect([...kinds].sort(), id).toEqual(want);
      for (const k of kinds) covered.add(k);
      for (const d of m.default) expect(d, d.kind).toBe(modules[`./${d.kind}.ts`]!.default);
    }
    expect([...covered].sort()).toEqual(MODULE_KINDS);
  });

  it("loads a garden's creatures on demand; a garden without a set has none to load", async () => {
    await loadCreatures('japanese-garden');
    expect(creaturesLoaded('japanese-garden')).toBe(true);
    expect(creatureKinds()).toEqual(expect.arrayContaining(['bee', 'bird', 'butterfly', 'dragonfly', 'frog', 'heron', 'koi', 'leaf', 'strider', 'swallow']));
    expect(creaturesLoaded('nowhere')).toBe(true);
    await expect(loadCreatures('nowhere')).resolves.toBeUndefined();
    await loadAllCreatures();
    expect(creatureKinds()).toEqual(MODULE_KINDS);
    expect(creatureDefs().map((d) => d.kind)).toEqual(MODULE_KINDS);
    expect(creatureDef('flight')).toBeUndefined();
    expect(creatureDef('def')).toBeUndefined();
    expect(creatureDef('unicorn')).toBeUndefined();
  });

  it('each role carries what it needs: visitors and drifters a visit, residents a count', () => {
    for (const { default: def } of Object.values(modules)) {
      const kind = def.kind;
      if (def.role === 'resident') expect(def.resident, kind).toBeTypeOf('function');
      else expect(def.visit, kind).toBeDefined();
      if (def.role === 'drifter') expect(def.visit!.visitor, kind).toBe(false);
      if (def.role === 'visitor') expect(def.visit!.visitor, kind).toBe(true);
    }
  });

  it('kinds come from file names', () => {
    expect(kindFromPath('./koi.ts')).toBe('koi');
    expect(kindFromPath('/src/fauna/creatures/brown-dipper.ts')).toBe('brown-dipper');
    expect(setIdFromPath('./sets/creatures-japanese-garden.ts')).toBe('japanese-garden');
  });
});
