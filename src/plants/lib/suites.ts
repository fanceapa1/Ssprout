/**
 * Test-only: the family suites every species test calls (`species/<id>.test.ts`, ADR 0251).
 * One call per species keeps adding a species to adding files (docs/systems/species-recipe.md).
 */
import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../../core/rng';
import { getSpecies } from '../registry';
import { fitsSize, HABITATS, type Habitat, type SizeClass, type SpeciesDef } from '../types';
import { callMagnitude, callNumbers, recordingPainter, type PaintCall } from './small-recorder';

function record(def: SpeciesDef, seed: number, growth: number): PaintCall[] {
  const { painter, calls } = recordingPainter(def.size.w * 2, def.size.h * 2);
  def.draw(painter, createRng(seed).fork(def.id), { w: def.size.w * 2, h: def.size.h * 2, growth });
  return calls;
}

const marks = (calls: PaintCall[]) => new Map(calls.filter((c) => c.key && c.method !== 'layer.dry').map((c) => [c.key!, c]));

/**
 * Tier 1–2 species painted with the small-plant helpers (docs/systems/plants-species-a.md):
 * determinism and continuous growth. The session cross-fades 24 growth steps of one seed, so a
 * mark may only change a little between neighbouring growths, and only appear or vanish tiny.
 */
export function smallSuite(id: string): void {
  describe(`species ${id}`, () => {
    const def = getSpecies(id);

    it('is registered with a sensible definition', () => {
      expect(def, `species ${id} missing`).toBeDefined();
      const d = def!;
      expect(d.id).toBe(id);
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.nativeName?.length).toBeGreaterThan(2);
      expect(d.description.length).toBeGreaterThan(10);
      expect(d.description.length).toBeLessThan(80);
      expect(d.habitats.every((h) => HABITATS.includes(h))).toBe(true);
      expect([1, 2]).toContain(d.tier);
    });

    it('draws the same marks for the same seed and growth', () => {
      for (const g of [0, 0.3, 0.62, 1]) expect(record(def!, 11, g)).toEqual(record(def!, 11, g));
    });

    it('varies with the seed', () => {
      expect(record(def!, 1, 1)).not.toEqual(record(def!, 2, 1));
    });

    it('paints something at every growth value, more as it grows', () => {
      const counts = [0, 0.1, 0.3, 0.55, 0.8, 1].map((g) => record(def!, 5, g).length);
      for (const n of counts) expect(n).toBeGreaterThan(0);
      expect(counts.at(-1)!).toBeGreaterThan(counts[0]!);
    });

    it('grows continuously: no mark jumps, appears large or vanishes large', () => {
      const size = Math.max(def!.size.w, def!.size.h);
      for (const seed of [3, 8]) {
        let prev = marks(record(def!, seed, 0));
        for (let i = 1; i <= 200; i++) {
          const g = i / 200;
          const cur = marks(record(def!, seed, g));
          for (const [key, c] of cur) {
            const before = prev.get(key);
            if (!before) {
              expect(callMagnitude(c), `${key} appeared at g=${g} with ${JSON.stringify(c.args).slice(0, 200)}`).toBeLessThan(size * 0.012);
              continue;
            }
            const a = callNumbers(before);
            const b = callNumbers(c);
            if (a.length !== b.length) continue;
            // (angles may wrap by a full turn without anything visible happening)
            const TAU = Math.PI * 2;
            const jump = Math.max(0, ...a.map((v, j) => Math.min(Math.abs(v - b[j]!), Math.abs(Math.abs(v - b[j]!) - TAU))));
            expect(jump, `${key} jumped at g=${g}`).toBeLessThan(size * 0.05);
          }
          for (const [key, c] of prev) {
            if (!cur.has(key)) expect(callMagnitude(c), `${key} vanished at g=${g}`).toBeLessThan(size * 0.012);
          }
          prev = cur;
        }
      }
    }, 60_000); // 400 full draws per species: slow on a loaded machine
  });
}

export interface ShrubExpect {
  /** The habitats, in order. */
  habitats: Habitat[];
  /** Pinned when the shrub is smaller than `large`. */
  sizeClass?: SizeClass;
}

/** Tier-3 shrubs (docs/systems/plants-species-b.md): `build` is the species' structure from its rng. */
export function shrubSuite(id: string, build: (rng: Rng) => unknown, expected: ShrubExpect): void {
  describe(`tier-3 shrub ${id}`, () => {
    it('is registered as tier 3 with its habitats and size', () => {
      const def = getSpecies(id);
      expect(def, id).toBeDefined();
      expect(def!.tier).toBe(3);
      expect(def!.habitats).toEqual(expected.habitats);
      expect(def!.nativeName).toBeTruthy();
      expect(def!.description.length).toBeGreaterThan(10);
      expect(fitsSize(def!.sizeClass, 'large')).toBe(true);
      if (expected.sizeClass) expect(def!.sizeClass).toBe(expected.sizeClass);
    });

    it('the whole structure is a pure function of the seed', () => {
      const a = build(createRng(42).fork(id));
      expect(build(createRng(42).fork(id))).toEqual(a);
      expect(build(createRng(43).fork(id))).not.toEqual(a);
    });

    it('draw consumes the species rng identically at every growth', () => {
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
  });
}

/** A painter whose every method throws: draw() reaches it only after building the plant. */
function stubPainter(): never {
  const stop = () => {
    throw new Error('stub');
  };
  return new Proxy({}, { get: (_t, k) => (k === 'ctx' ? new Proxy({}, { get: () => stop }) : stop) }) as never;
}

/** Tier-4 trees (docs/systems/plants-species-c.md): `plan` builds skeleton, foliage and blossom from the rng alone. */
export function treeSuite(id: string, plan: (rng: Rng) => unknown): void {
  describe(`tier-4 tree ${id}`, () => {
    it('is registered as a tier-4 species with a sane box', () => {
      const def = getSpecies(id)!;
      expect(def).toBeDefined();
      expect(def.tier).toBe(4);
      expect(def.size.w).toBeGreaterThan(200);
      expect(['large', 'tree']).toContain(def.sizeClass);
      expect(def.anchor.y).toBeGreaterThan(0.8);
    });

    it('is deterministic per seed', () => {
      expect(JSON.stringify(plan(createRng(42).fork(id)))).toEqual(JSON.stringify(plan(createRng(42).fork(id))));
    });

    it('varies with the seed', () => {
      expect(JSON.stringify(plan(createRng(1).fork(id)))).not.toEqual(JSON.stringify(plan(createRng(2).fork(id))));
    });

    it('does not depend on how much of the rng the caller already used', () => {
      const a = createRng(9).fork(id);
      const b = createRng(9).fork(id);
      b.next();
      b.next();
      expect(JSON.stringify(plan(a))).toEqual(JSON.stringify(plan(b)));
    });

    it('stays inside the sprite box', () => {
      const def = getSpecies(id)!;
      for (let s = 1; s <= 12; s++) {
        const p = plan(createRng(s).fork(id)) as { tree: { branches: { pts: { x: number; y: number }[] }[] } };
        for (const b of p.tree.branches)
          for (const q of b.pts) {
            expect(q.x).toBeGreaterThan(0);
            expect(q.x).toBeLessThan(def.size.w);
            expect(q.y).toBeGreaterThan(0);
            expect(q.y).toBeLessThan(def.size.h);
          }
      }
    });
  });
}
