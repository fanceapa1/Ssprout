import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import { fitsSize } from '../types';
import rockRose, { buildRockRose, poseRockRose, rockRoseReach, type RockRosePose } from './rock-rose';

smallSuite('rock-rose');

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: RockRosePose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const l of pose.leaves) out.set(l.id, { size: l.len * l.alpha, pts: l.geom.outline.flatMap((q) => [q.x, q.y]) });
  for (const s of pose.twigs) {
    const a = s.pts[0]!;
    const b = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(Math.hypot(b.x - a.x, b.y - a.y), s.width), pts: [...s.pts.flatMap((q) => [q.x, q.y]), s.width] });
  }
  for (const f of pose.flowers) out.set(f.id, { size: f.R * f.alpha, pts: [f.at.x, f.at.y, f.R, f.open, f.bud] });
  pose.litter.forEach((m, i) => out.set(`litter-${i}`, { size: m.len * m.alpha, pts: [m.at.x, m.at.y, m.len] }));
  return out;
}

const build = (seed: number) => buildRockRose(createRng(seed).fork('rock-rose'));

describe('pink rock rose', () => {
  const size = Math.max(rockRose.size.w, rockRose.size.h);

  it('grows continuously: no mark jumps, appears small or vanishes small', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseRockRose(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseRockRose(plant, g));
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

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = rockRose.size;
    const left = -w * rockRose.anchor.x;
    const top = -h * rockRose.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = rockRoseReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('in bloom: open flowers, fat buds and fallen petals show together on a leafy mound', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseRockRose(build(seed), 1);
      const opened = pose.flowers.filter((f) => f.open > 0.95);
      const buds = pose.flowers.filter((f) => f.bud > 0.5);
      expect(opened.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      expect(buds.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(pose.flowers.every((f) => f.petals.length === 5)).toBe(true);
      expect(pose.litter.filter((m) => m.alpha > 0.95).length, `seed ${seed}`).toBeGreaterThanOrEqual(5);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThan(60);
    }
  });

  it('grows a grey-leaved twiggy seedling, a leafy bush with buds, then the bush dotted with flowers', () => {
    const plant = build(2);
    const seedling = poseRockRose(plant, 0.18);
    const bush = poseRockRose(plant, 0.55);
    const bloom = poseRockRose(plant, 1);
    expect(seedling.twigs.length).toBeGreaterThanOrEqual(2);
    expect(seedling.leaves.length).toBeGreaterThan(0);
    expect(seedling.flowers.length).toBe(0);
    expect(bush.leaves.length).toBeGreaterThan(seedling.leaves.length * 3);
    expect(bush.flowers.length).toBeGreaterThan(0);
    expect(Math.max(0, ...bush.flowers.map((f) => f.open))).toBeLessThan(0.4);
    expect(bloom.flowers.filter((f) => f.open > 0.95).length).toBeGreaterThan(bush.flowers.length);
  });

  it('is a tier-2 small plant of the scrub and the path, pink, visited by pollinators', () => {
    const def = getSpecies('rock-rose')!;
    expect(def.tier).toBe(2);
    expect(def.sizeClass).toBe('small');
    expect(def.size).toEqual({ w: 86, h: 86 });
    expect(def.habitats).toEqual(['back', 'path']);
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#c9609a');
  });

  it('fits all five path slots of the coast and the five small scrub slots', () => {
    for (const h of ['path', 'back'] as const) {
      const fits = COAST_SLOTS.filter((s) => s.habitat === h && fitsSize(rockRose.sizeClass, s.maxSize));
      expect(fits.length, h).toBeGreaterThanOrEqual(5);
    }
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('rock-rose', rockRose.range, COAST_FLORA)).toBe(true);
    expect(growsIn('rock-rose', rockRose.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('rock-rose', rockRose.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('rock-rose', rockRose.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
