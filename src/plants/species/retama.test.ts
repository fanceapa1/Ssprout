import { describe, expect, it } from 'vitest';
import { isCompatible } from '../../core/placement';
import { createRng } from '../../core/rng';
import { OASIS_SLOTS } from '../../scenery/oasis/slots';
import { getSpecies } from '../registry';
import { smallSuite } from '../lib/suites';
import retama, { buildRetama, poseRetama, retamaReach, type RetamaPose } from './retama';

smallSuite('retama');

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: RetamaPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const r of pose.rods) {
    let len = 0;
    for (let i = 1; i < r.pts.length; i++) len += Math.hypot(r.pts[i]!.x - r.pts[i - 1]!.x, r.pts[i]!.y - r.pts[i - 1]!.y);
    const tip = r.pts[r.pts.length - 1]!;
    out.set(r.id, { size: Math.max(len, r.width), pts: [r.pts[0]!.x, r.pts[0]!.y, tip.x, tip.y, r.width] });
  }
  for (const b of pose.body) out.set(b.id, { size: b.rx * 2 * b.alpha, pts: [b.at.x, b.at.y, b.rx * b.alpha, b.ry * b.alpha] });
  for (const f of pose.flowers) out.set(f.id, { size: f.size * 2 * f.alpha, pts: [f.at.x, f.at.y, f.size, f.open * f.size] });
  return out;
}

const build = (seed: number) => buildRetama(createRng(seed).fork('retama'));

describe('white broom', () => {
  const size = Math.max(retama.size.w, retama.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseRetama(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseRetama(plant, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(size * 0.012);
            continue;
          }
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(size * 0.03);
        }
        for (const [id, m] of prev) if (!cur.has(id)) expect(m.size, `${id} vanished at g=${g}`).toBeLessThan(size * 0.012);
        prev = cur;
      }
    }
  }, 60_000); // hundreds of full poses: slow on a loaded machine

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = retama.size;
    const left = -w * retama.anchor.x;
    const top = -h * retama.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = retamaReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 3);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 3);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 3);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('is a leafless fountain of arching rods that weep at the sides, foaming with white flowers', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = build(seed);
      const pose = poseRetama(plant, 1);
      const rods = pose.rods.filter((r) => r.kind === 'rod');
      expect(rods.length, `seed ${seed}`).toBeGreaterThanOrEqual(30);
      expect(pose.rods.filter((r) => r.kind === 'twig').length, `seed ${seed}`).toBeGreaterThanOrEqual(30);
      // the outer rods arch over: their tips hang lower than the highest point they reach
      const weeping = rods.filter((r) => {
        const tip = r.pts[r.pts.length - 1]!;
        return tip.y > Math.min(...r.pts.map((q) => q.y)) + 8;
      });
      expect(weeping.length, `seed ${seed}`).toBeGreaterThan(rods.length / 3);
      // a mound: wider than it is tall
      const pts = pose.rods.flatMap((r) => r.pts);
      const width = Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x));
      const height = -Math.min(...pts.map((q) => q.y));
      expect(width, `seed ${seed}`).toBeGreaterThan(height * 0.75);
      const open = pose.flowers.filter((f) => f.open > 0.99);
      expect(open.length, `seed ${seed}`).toBeGreaterThan(300);
      expect(pose.flowers.length - open.length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('grows a few rods, then a fuller mound, then buds, then the white bloom', () => {
    const plant = build(2);
    const young = poseRetama(plant, 0.3);
    const fuller = poseRetama(plant, 0.48);
    const rodsAt = (p: RetamaPose) => p.rods.filter((r) => r.kind !== 'wood').length;
    expect(rodsAt(young)).toBeGreaterThan(0);
    expect(rodsAt(young)).toBeLessThan(rodsAt(fuller) / 3);
    expect(young.flowers.length).toBe(0);
    expect(fuller.flowers.length).toBe(0);
    const budding = poseRetama(plant, 0.72);
    expect(budding.flowers.length).toBeGreaterThan(200);
    expect(budding.flowers.every((f) => f.open < 0.01)).toBe(true);
    const full = poseRetama(plant, 1);
    expect(full.flowers.filter((f) => f.open > 0.99).length).toBeGreaterThan(300);
  });

  it('is a wild medium tier-2 shrub of sand, banks and the back, white, visited by bees', () => {
    const def = getSpecies('retama')!;
    expect(def.tier).toBe(2);
    expect(def.sizeClass).toBe('medium');
    expect(def.size).toEqual({ w: 120, h: 160 });
    expect(def.habitats).toEqual(['path', 'shore', 'back']);
    expect(def.range).toEqual({ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'coast'], climates: ['arid'] });
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#f6f2ea');
  });

  it('fits real oasis slots on the sand, the banks and the back', () => {
    const fits = OASIS_SLOTS.filter((slot) => isCompatible(retama, slot)).map((slot) => slot.id);
    expect(fits).toEqual(expect.arrayContaining(['walk-3', 'walk-4', 'oued-1', 'oued-2', 'oued-3', 'high-2', 'grove-1']));
  });
});
