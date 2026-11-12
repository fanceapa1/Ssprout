import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import seaDaffodil, { buildSeaDaffodil, poseSeaDaffodil, seaDaffodilReach, type SeaDaffodilPose } from './sea-daffodil';

smallSuite('sea-daffodil');

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: SeaDaffodilPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const r of [...pose.leaves, ...pose.stalks]) {
    const tip = r.pts[r.pts.length - 1]!;
    const len = Math.hypot(tip.x - r.pts[0]!.x, tip.y - r.pts[0]!.y);
    out.set(r.id, { size: Math.max(len, r.width), pts: [r.pts[0]!.x, r.pts[0]!.y, tip.x, tip.y, r.width] });
  }
  for (const b of pose.hazes) out.set(b.id, { size: b.rx * 2 * b.alpha, pts: [b.at.x, b.at.y, b.rx * b.alpha, b.ry * b.alpha] });
  for (const f of pose.flowers) {
    const tips = f.tepals.flatMap((t) => [t.pts[3].x, t.pts[3].y]);
    out.set(f.id, { size: Math.hypot(f.throat.x - f.at.x, f.throat.y - f.at.y) * f.alpha, pts: [f.at.x, f.at.y, f.mouth.x, f.mouth.y, f.cupR, f.open, ...tips] });
  }
  return out;
}

const build = (seed: number) => buildSeaDaffodil(createRng(seed).fork('sea-daffodil'));

describe('sea daffodil', () => {
  const size = Math.max(seaDaffodil.size.w, seaDaffodil.size.h);

  it('grows continuously: no mark jumps, appears small or vanishes small', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseSeaDaffodil(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseSeaDaffodil(plant, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(size * 0.04);
            continue;
          }
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(size * 0.04);
        }
        for (const [id, m] of prev) if (!cur.has(id)) expect(m.size, `${id} vanished at g=${g}`).toBeLessThan(size * 0.04);
        prev = cur;
      }
    }
  }, 60_000);

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = seaDaffodil.size;
    const left = -w * seaDaffodil.anchor.x;
    const top = -h * seaDaffodil.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = seaDaffodilReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 3);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 3);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 3);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('is a leaf tuft under a bare stalk that carries an umbel of four to six six-tepalled trumpets', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseSeaDaffodil(build(seed), 1);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThanOrEqual(10);
      expect(pose.flowers.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      expect(pose.flowers.length, `seed ${seed}`).toBeLessThanOrEqual(6);
      const stalk = pose.stalks.find((s) => s.id === 'stalk')!;
      const stalkTop = stalk.pts[stalk.pts.length - 1]!.y;
      const leafTop = Math.min(...pose.leaves.flatMap((l) => l.pts.map((q) => q.y)));
      expect(stalkTop, `seed ${seed}: the stalk rises above the leaves`).toBeLessThan(leafTop - 4);
      for (const f of pose.flowers) {
        expect(f.tepals.length).toBe(6);
        expect(f.open).toBeGreaterThan(0.95);
        expect(f.cupR).toBeGreaterThan(3.5);
      }
    }
  });

  it('grows a few grey leaves, then a leaf tuft with a budded stalk, then the open umbel', () => {
    const plant = build(2);
    const first = poseSeaDaffodil(plant, 0.14);
    const tuft = poseSeaDaffodil(plant, 0.4);
    const buds = poseSeaDaffodil(plant, 0.58);
    const bloom = poseSeaDaffodil(plant, 1);
    expect(first.leaves.length).toBeGreaterThan(0);
    expect(first.leaves.length).toBeLessThan(plant.leaves.length);
    expect(first.stalks.length + first.flowers.length).toBe(0);
    expect(tuft.leaves.length).toBe(plant.leaves.length);
    expect(tuft.stalks.length).toBe(1);
    expect(tuft.flowers.length).toBe(0);
    expect(buds.flowers.length).toBeGreaterThan(0);
    expect(Math.max(...buds.flowers.map((f) => f.open))).toBeLessThan(0.5);
    expect(bloom.flowers.every((f) => f.open > 0.95)).toBe(true);
    expect(bloom.hazes.length).toBeGreaterThan(0);
  });

  it('is a tier-2 medium plant of the beach sand, white, visited by pollinators', () => {
    const def = getSpecies('sea-daffodil')!;
    expect(def.tier).toBe(2);
    expect(def.sizeClass).toBe('medium');
    expect(def.size).toEqual({ w: 120, h: 160 });
    expect(def.habitats).toEqual(['shore']);
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#f6f2e8');
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('sea-daffodil', seaDaffodil.range, COAST_FLORA)).toBe(true);
    expect(growsIn('sea-daffodil', seaDaffodil.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('sea-daffodil', seaDaffodil.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('sea-daffodil', seaDaffodil.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
