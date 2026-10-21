import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { HABITATS, type SpeciesDef } from '../types';
import { callMagnitude, callNumbers, recordingPainter, type PaintCall } from './small-recorder';
import { SPECIES_A } from './small-species-list';

/**
 * Tier 1–2 species (docs/systems/plants-species-a.md): determinism and *continuous growth* —
 * the session cross-fades ~24 growth steps of the same seed, so a mark may only change a little
 * between neighbouring growth values and may only appear while still tiny or transparent.
 */

const ids = [...SPECIES_A[1], ...SPECIES_A[2]];

function record(def: SpeciesDef, seed: number, growth: number): PaintCall[] {
  const { painter, calls } = recordingPainter(def.size.w * 2, def.size.h * 2);
  def.draw(painter, createRng(seed).fork(def.id), { w: def.size.w * 2, h: def.size.h * 2, growth });
  return calls;
}

const marks = (calls: PaintCall[]) => new Map(calls.filter((c) => c.key && c.method !== 'layer.dry').map((c) => [c.key!, c]));

describe.each(ids)('species %s', (id) => {
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
    expect(SPECIES_A[d.tier as 1 | 2]).toContain(id);
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
