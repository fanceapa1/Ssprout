import { describe, expect, it } from 'vitest';
import { creatureDef, creatureKinds, kindFromPath, registryEntries } from './registry';

describe('creature registry', () => {
  it('finds every creature module, and each def names its own file', () => {
    const entries = registryEntries();
    expect(entries.length).toBeGreaterThanOrEqual(10);
    for (const [path, def] of entries) expect(def.kind, path).toBe(kindFromPath(path));
  });

  it('has the Japanese garden creatures; helpers in lib/ are not creatures', () => {
    expect(creatureKinds()).toEqual(expect.arrayContaining(['bee', 'bird', 'butterfly', 'dragonfly', 'frog', 'heron', 'koi', 'leaf', 'strider', 'swallow']));
    expect(creatureDef('flight')).toBeUndefined();
    expect(creatureDef('def')).toBeUndefined();
    expect(creatureDef('unicorn')).toBeUndefined();
  });

  it('each role carries what it needs: visitors and drifters a visit, residents a count', () => {
    for (const kind of creatureKinds()) {
      const def = creatureDef(kind)!;
      if (def.role === 'resident') expect(def.resident, kind).toBeTypeOf('function');
      else expect(def.visit, kind).toBeDefined();
      if (def.role === 'drifter') expect(def.visit!.visitor, kind).toBe(false);
      if (def.role === 'visitor') expect(def.visit!.visitor, kind).toBe(true);
    }
  });

  it('kinds come from file names', () => {
    expect(kindFromPath('./koi.ts')).toBe('koi');
    expect(kindFromPath('/src/fauna/creatures/brown-dipper.ts')).toBe('brown-dipper');
  });
});
