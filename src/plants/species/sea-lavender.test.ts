import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import { fitsSize } from '../types';
import seaLavender, { buildSeaLavender, poseSeaLavender, seaLavenderReach, type SeaLavenderPose } from './sea-lavender';

smallSuite('sea-lavender');

type Mark = { size: number; pts: number[] };

function marks(pose: SeaLavenderPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const l of pose.leaves) out.set(l.id, { size: l.len * l.alpha, pts: l.geom.outline.flatMap((q) => [q.x, q.y]) });
  for (const s of pose.wires) {
    const a = s.pts[0]!;
    const b = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(Math.hypot(b.x - a.x, b.y - a.y), s.width), pts: [...s.pts.flatMap((q) => [q.x, q.y]), s.width] });
  }
  for (const d of pose.dots) out.set(d.id, { size: d.r * d.alpha, pts: [d.at.x, d.at.y, d.r] });
  for (const h of pose.hazes) out.set(h.id, { size: Math.max(h.rx, h.ry) * h.alpha, pts: [h.at.x, h.at.y, h.rx, h.ry] });
  return out;
}

const build = (seed: number) => buildSeaLavender(createRng(seed).fork('sea-lavender'));

describe('sea lavender', () => {
  const size = Math.max(seaLavender.size.w, seaLavender.size.h);

  it('grows continuously: no mark jumps, appears small or vanishes small', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseSeaLavender(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseSeaLavender(plant, g));
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
    const { w, h } = seaLavender.size;
    const left = -w * seaLavender.anchor.x;
    const top = -h * seaLavender.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = seaLavenderReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('in bloom: a flat rosette, three or four bare stems and a branched froth of many flowers above it', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseSeaLavender(build(seed), 1);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThanOrEqual(10);
      expect(pose.wires.filter((s) => /^m\d+$/.test(s.id)).length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(pose.wires.length, `seed ${seed}: forked`).toBeGreaterThan(30);
      expect(pose.dots.length, `seed ${seed}`).toBeGreaterThan(120);
      const leafTop = Math.min(...pose.leaves.flatMap((l) => l.geom.outline.map((q) => q.y)));
      const flowerLow = Math.min(...pose.dots.map((d) => d.at.y));
      expect(leafTop, `seed ${seed}: rosette is low`).toBeGreaterThan(-14);
      expect(flowerLow, `seed ${seed}: froth stands well above it`).toBeLessThan(-40);
      const spread = Math.max(...pose.dots.map((d) => d.at.x)) - Math.min(...pose.dots.map((d) => d.at.x));
      expect(spread, `seed ${seed}: wide and airy`).toBeGreaterThan(30);
    }
  });

  it('grows a small rosette, then bare stems, then the froth of flowers', () => {
    const plant = build(2);
    const seedling = poseSeaLavender(plant, 0.2);
    const rosette = poseSeaLavender(plant, 0.4);
    const bloom = poseSeaLavender(plant, 1);
    expect(seedling.leaves.length).toBeGreaterThanOrEqual(3);
    expect(seedling.dots.length).toBe(0);
    expect(rosette.leaves.length).toBeGreaterThan(seedling.leaves.length);
    expect(rosette.dots.length).toBe(0);
    expect(bloom.dots.length).toBeGreaterThan(100);
  });

  it('is a tier-2 small plant of the rock, pale lilac, visited by pollinators', () => {
    const def = getSpecies('sea-lavender')!;
    expect(def.tier).toBe(2);
    expect(def.sizeClass).toBe('small');
    expect(def.size).toEqual({ w: 86, h: 86 });
    expect(def.habitats).toEqual(['rock']);
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#c0a8d0');
  });

  it('fits every rock slot of the coast: the wall cracks, the splash rocks and the shelf', () => {
    const rock = COAST_SLOTS.filter((s) => s.habitat === 'rock');
    expect(rock.length).toBe(11);
    expect(rock.every((s) => fitsSize(seaLavender.sizeClass, s.maxSize))).toBe(true);
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('sea-lavender', seaLavender.range, COAST_FLORA)).toBe(true);
    expect(growsIn('sea-lavender', seaLavender.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('sea-lavender', seaLavender.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('sea-lavender', seaLavender.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
