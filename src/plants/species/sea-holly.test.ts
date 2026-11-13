import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import seaHolly, { buildSeaHolly, poseSeaHolly, seaHollyReach, type SeaHollyPose } from './sea-holly';

smallSuite('sea-holly');

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: SeaHollyPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const l of pose.leaves) {
    const o = l.geom.outline;
    const far = o[Math.floor(o.length / 2)]!;
    out.set(l.id, { size: Math.hypot(o[0]!.x - far.x, o[0]!.y - far.y) * l.alpha, pts: o.flatMap((q) => [q.x, q.y]) });
  }
  for (const s of pose.stems) {
    const a = s.pts[0]!;
    const b = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(Math.hypot(b.x - a.x, b.y - a.y), s.width), pts: [...s.pts.flatMap((q) => [q.x, q.y]), s.width] });
  }
  for (const h of pose.heads) {
    out.set(h.id, { size: Math.max(h.rx, h.ry) * h.alpha, pts: [h.at.x, h.at.y, h.rx, h.ry, h.open] });
    h.bracts.forEach((b, i) => {
      const m = b.geom.mid;
      out.set(`${h.id}-b${i}`, { size: Math.hypot(m[3]!.x - m[0]!.x, m[3]!.y - m[0]!.y) * b.alpha, pts: b.geom.outline.flatMap((q) => [q.x, q.y]) });
    });
  }
  return out;
}

const build = (seed: number) => buildSeaHolly(createRng(seed).fork('sea-holly'));

describe('sea holly', () => {
  const size = Math.max(seaHolly.size.w, seaHolly.size.h);

  it('grows continuously: no mark jumps, appears small or vanishes small', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseSeaHolly(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseSeaHolly(plant, g));
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
    const { w, h } = seaHolly.size;
    const left = -w * seaHolly.anchor.x;
    const top = -h * seaHolly.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = seaHollyReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('is a clump of spiny leaves under a branching crown of seven blue heads in bract collars', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseSeaHolly(build(seed), 1);
      const basal = pose.leaves.filter((l) => l.id.startsWith('leaf'));
      expect(basal.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      expect(pose.heads.length, `seed ${seed}`).toBe(7);
      for (const h of pose.heads) {
        expect(h.open).toBeGreaterThan(0.95);
        expect(h.bracts.length).toBeGreaterThanOrEqual(7);
        expect(h.florets).toBeGreaterThan(0.95);
      }
      const headTop = Math.min(...pose.heads.map((h) => h.at.y));
      const leafTop = Math.min(...basal.flatMap((l) => l.geom.outline.map((q) => q.y)));
      expect(headTop, `seed ${seed}: the heads crown the clump`).toBeLessThan(leafTop - 8);
    }
  });

  it('grows a rosette, then a branching silver clump, then the blue crown', () => {
    const plant = build(2);
    const rosette = poseSeaHolly(plant, 0.16);
    const clump = poseSeaHolly(plant, 0.55);
    const crown = poseSeaHolly(plant, 1);
    expect(rosette.leaves.length).toBeGreaterThan(0);
    expect(rosette.stems.length + rosette.heads.length).toBe(0);
    expect(clump.stems.length).toBeGreaterThan(3);
    expect(Math.max(0, ...clump.heads.map((h) => h.open))).toBeLessThan(0.4);
    expect(crown.heads.every((h) => h.open > 0.95)).toBe(true);
    const tone = (pose: SeaHollyPose, id: string) => pose.stems.find((s) => s.id === id)!.pigment;
    expect(tone(crown, 'c')).not.toBe(tone(crown, 't'));
  });

  it('is a tier-2 small plant of the beach sand, blue, visited by pollinators', () => {
    const def = getSpecies('sea-holly')!;
    expect(def.tier).toBe(2);
    expect(def.sizeClass).toBe('small');
    expect(def.size).toEqual({ w: 86, h: 86 });
    expect(def.habitats).toEqual(['shore']);
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#8fa6c4');
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('sea-holly', seaHolly.range, COAST_FLORA)).toBe(true);
    expect(growsIn('sea-holly', seaHolly.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('sea-holly', seaHolly.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('sea-holly', seaHolly.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
