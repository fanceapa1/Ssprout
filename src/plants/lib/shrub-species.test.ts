import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../../core/rng';
import { getSpecies } from '../registry';
import { fitsSize } from '../types';
import { buildAzalea } from '../species/azalea';
import { buildCamellia } from '../species/camellia';
import { buildChrysanthemum } from '../species/chrysanthemum';
import { buildHydrangea } from '../species/hydrangea';
import { buildLotus } from '../species/lotus';
import { buildPeony } from '../species/tree-peony';
import { bloomMarks, bloomState } from './shrub-paint';

const BUILDERS: Record<string, (rng: Rng) => unknown> = {
  'tree-peony': buildPeony,
  hydrangea: buildHydrangea,
  azalea: buildAzalea,
  camellia: buildCamellia,
  chrysanthemum: buildChrysanthemum,
  lotus: buildLotus,
};

describe('tier-3 shrubs', () => {
  it('are registered as tier 3 with their habitats and sizes', () => {
    const expected: Record<string, string[]> = {
      'tree-peony': ['meadow', 'back'],
      hydrangea: ['meadow', 'shore', 'back'],
      azalea: ['meadow', 'rock', 'path'],
      camellia: ['back', 'meadow'],
      chrysanthemum: ['meadow', 'path'],
      lotus: ['water'],
    };
    for (const [id, habitats] of Object.entries(expected)) {
      const def = getSpecies(id);
      expect(def, id).toBeDefined();
      expect(def!.tier).toBe(3);
      expect(def!.habitats).toEqual(habitats);
      expect(def!.nativeName).toBeTruthy();
      expect(def!.description.length).toBeGreaterThan(10);
      expect(fitsSize(def!.sizeClass, 'large')).toBe(true);
    }
    expect(getSpecies('chrysanthemum')!.sizeClass).toBe('medium');
    expect(getSpecies('azalea')!.sizeClass).toBe('medium');
  });

  for (const [id, build] of Object.entries(BUILDERS)) {
    it(`${id}: the whole structure is a pure function of the seed`, () => {
      const a = build(createRng(42).fork(id));
      expect(build(createRng(42).fork(id))).toEqual(a);
      expect(build(createRng(43).fork(id))).not.toEqual(a);
    });

    it(`${id}: draw consumes the species rng identically at every growth`, () => {
      // draw() builds the plant from the rng first; the rest of painting uses per-element
      // seeds, so the stream position afterwards must not depend on growth
      const def = getSpecies(id)!;
      const after = (growth: number) => {
        const rng = createRng(5).fork(id);
        try {
          def.draw(stubPainter(), rng, { w: 200, h: 220, growth });
        } catch {
          // the stub cannot paint; we only care about what was drawn from rng before that
        }
        return rng.next();
      };
      const ref = after(0);
      for (const g of [0.1, 0.5, 1]) expect(after(g)).toBe(ref);
    });
  }

  it('seeds vary the colourway', () => {
    const colours = new Set<string>();
    for (let s = 0; s < 24; s++) colours.add(buildChrysanthemum(createRng(s).fork('chrysanthemum')).colour.ray);
    expect(colours.size).toBeGreaterThanOrEqual(3);
  });

  it('a bloom keeps its petals from bud to full bloom', () => {
    const plant = buildCamellia(createRng(3).fork('camellia'));
    const { bloom, bud, open } = plant.blooms[0]!;
    const counts = [0.5, 0.7, 0.85, 1].map((g) => bloomMarks(bloom, bloomState(g, bud, open)).length);
    expect(new Set(counts).size).toBe(1);
    const late = bloomState(1, bud, open);
    expect(late.open).toBe(1);
    expect(late.colour).toBe(1);
    expect(bloomState(0.2, bud, open).size).toBe(0);
  });
});

/** A painter whose every method throws: draw() reaches it only after building the plant. */
function stubPainter(): never {
  const stop = () => {
    throw new Error('stub');
  };
  return new Proxy({}, { get: (_t, k) => (k === 'ctx' ? new Proxy({}, { get: () => stop }) : stop) }) as never;
}
