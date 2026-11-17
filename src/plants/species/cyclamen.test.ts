import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import cyclamen, { buildCyclamen, cyclamenReach, poseCyclamen, type CyclamenPose } from './cyclamen';

smallSuite('cyclamen');

type Mark = { size: number; pts: number[] };

function marks(pose: CyclamenPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const l of pose.leaves) {
    const o = l.geom.outline;
    const far = o[Math.floor(o.length / 2)]!;
    out.set(l.id, { size: Math.hypot(o[0]!.x - far.x, o[0]!.y - far.y) * l.alpha, pts: o.flatMap((q) => [q.x, q.y]) });
  }
  for (const s of [...pose.stalks, ...pose.coils]) {
    const a = s.pts[0]!;
    const b = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(Math.hypot(b.x - a.x, b.y - a.y), s.width), pts: [...s.pts.flatMap((q) => [q.x, q.y]), s.width] });
  }
  for (const f of pose.flowers) {
    const pts = f.geom.petals.flatMap((q) => q.poly);
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    out.set(f.id, { size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * f.alpha, pts: [...pts.flatMap((q) => [q.x, q.y]), f.open] });
  }
  for (const c of pose.capsules) out.set(c.id, { size: c.r * c.alpha, pts: [c.at.x, c.at.y, c.r] });
  return out;
}

const build = (seed: number) => buildCyclamen(createRng(seed).fork('cyclamen'));

describe('cyclamen', () => {
  const size = 70;

  it('grows continuously: no mark jumps, appears small or vanishes small', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseCyclamen(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseCyclamen(plant, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(size * 0.05);
            continue;
          }
          if (before.pts.length !== m.pts.length) continue;
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(size * 0.06);
        }
        for (const [id, m] of prev) if (!cur.has(id)) expect(m.size, `${id} vanished at g=${g}`).toBeLessThan(size * 0.05);
        prev = cur;
      }
    }
  }, 60_000);

  it('stays inside its design box at full growth, clear of the sides and the top', () => {
    const left = -size * 0.5;
    const top = -size * 0.8;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = cyclamenReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + size - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + size);
    }
  });

  it('is a rosette of nine or more leaves under a dozen flowers of different heights', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseCyclamen(build(seed), 1);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThanOrEqual(9);
      expect(pose.flowers.length, `seed ${seed}`).toBeGreaterThanOrEqual(12);
      const heights = pose.flowers.map((f) => f.geom.mouth.y);
      expect(new Set(heights.map((y) => Math.round(y))).size, `seed ${seed}: heights differ`).toBeGreaterThanOrEqual(6);
      expect(Math.max(...heights) - Math.min(...heights), `seed ${seed}: spread of heights`).toBeGreaterThan(14);
      const leafTop = Math.min(...pose.leaves.flatMap((l) => l.geom.outline.map((q) => q.y)));
      expect(Math.min(...pose.flowers.map((f) => f.geom.mouth.y)), `seed ${seed}: flowers rise above the leaves`).toBeLessThan(leafTop - 12);
      for (const f of pose.flowers) {
        expect(f.open).toBeGreaterThan(0.95);
        expect(f.geom.petals).toHaveLength(5);
      }
    }
  });

  it('grows a tuber and a few leaves, then the rosette with buds, then the flowers and coiled seed stalks', () => {
    const plant = build(2);
    const first = poseCyclamen(plant, 0.14);
    const rosette = poseCyclamen(plant, 0.45);
    const full = poseCyclamen(plant, 1);
    expect(first.leaves.length).toBeGreaterThanOrEqual(2);
    expect(first.leaves.length).toBeLessThan(rosette.leaves.length);
    expect(first.flowers.length).toBe(0);
    const mid = poseCyclamen(plant, 0.62);
    expect(mid.flowers.length).toBeGreaterThan(2);
    expect(mid.flowers.some((f) => f.open < 0.3)).toBe(true);
    expect(full.coils.length).toBeGreaterThanOrEqual(2);
    expect(full.capsules.length).toBeGreaterThanOrEqual(2);
  });

  it('is a tier-1 small plant of walls, terraces and scrub, pink, visited by pollinators', () => {
    const def = getSpecies('cyclamen')!;
    expect(def.tier).toBe(1);
    expect(def.sizeClass).toBe('small');
    expect(def.size).toEqual({ w: 86, h: 86 });
    expect(def.habitats).toEqual(['rock', 'meadow', 'back']);
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#d98aa6');
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('cyclamen', cyclamen.range, COAST_FLORA)).toBe(true);
    expect(growsIn('cyclamen', cyclamen.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('cyclamen', cyclamen.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('cyclamen', cyclamen.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
