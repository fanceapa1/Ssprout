import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { growsIn } from '../flora';
import { shrubSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import { isCompatible } from '../../core/placement';
import jerusalemSage, { buildJerusalemSage, jerusalemSageReach, poseJerusalemSage, type JerusalemSagePose } from './jerusalem-sage';

shrubSuite('jerusalem-sage', buildJerusalemSage, { habitats: ['back', 'meadow', 'rock'], sizeClass: 'medium' });

type Mark = { size: number; pts: number[] };

function marks(pose: JerusalemSagePose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const l of [...pose.leaves, ...pose.bracts]) out.set(l.id, { size: l.len * l.alpha, pts: l.geom.outline.flatMap((q) => [q.x, q.y]) });
  for (const s of pose.stems) {
    const a = s.pts[0]!;
    const b = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(Math.hypot(b.x - a.x, b.y - a.y), s.width), pts: [...s.pts.flatMap((q) => [q.x, q.y]), s.width] });
  }
  for (const w of pose.whorls) out.set(w.id, { size: w.R * w.alpha, pts: [w.at.x, w.at.y, w.R, w.open * 10] });
  pose.mass.forEach((m, i) => out.set(`mass-${i}`, { size: m.rx * m.alpha, pts: [m.cx, m.cy, m.rx, m.ry] }));
  return out;
}

const build = (seed: number) => buildJerusalemSage(createRng(seed).fork('jerusalem-sage'));

describe('Jerusalem sage', () => {
  const size = Math.max(jerusalemSage.size.w, jerusalemSage.size.h);

  it('grows continuously: no mark jumps, appears small or vanishes small', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseJerusalemSage(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseJerusalemSage(plant, g));
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
    const { w, h } = jerusalemSage.size;
    const left = -w * jerusalemSage.anchor.x;
    const top = -h * jerusalemSage.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = jerusalemSageReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('in bloom: upright stems carry two or three stacked open whorls above a leafy mound', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseJerusalemSage(build(seed), 1);
      expect(pose.stems.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThan(120);
      expect(pose.whorls.every((w) => w.open === 1), `seed ${seed}: all open`).toBe(true);
      const moundTop = Math.min(...pose.leaves.flatMap((l) => l.geom.outline.map((q) => q.y)));
      pose.stems.forEach((s, si) => {
        const tiers = pose.whorls.filter((w) => w.id.startsWith(`whorl-${si}-`));
        expect(tiers.length, `seed ${seed} stem ${si}`).toBeGreaterThanOrEqual(2);
        expect(tiers.length).toBeLessThanOrEqual(3);
        for (let k = 1; k < tiers.length; k++) expect(tiers[k]!.at.y - tiers[k - 1]!.at.y, `seed ${seed}: stacked`).toBeGreaterThan(12);
        const a = s.pts[0]!;
        const b = s.pts.at(-1)!;
        expect(Math.abs(b.x - a.x) / (a.y - b.y), `seed ${seed}: upright`).toBeLessThan(0.35);
      });
      const lowest = Math.max(...pose.whorls.map((w) => w.at.y + w.R * 0.5));
      expect(lowest, `seed ${seed}: whorls stand over the mound`).toBeLessThan(moundTop + 12);
    }
  });

  it('grows a grey leafy tuft, then a mound with green budding stems, then the yellow tiers', () => {
    const plant = build(2);
    const tuft = poseJerusalemSage(plant, 0.15);
    const mound = poseJerusalemSage(plant, 0.45);
    const buds = poseJerusalemSage(plant, 0.62);
    const bloom = poseJerusalemSage(plant, 1);
    expect(tuft.leaves.length).toBeGreaterThan(0);
    expect(tuft.stems.length).toBe(0);
    expect(mound.leaves.length).toBeGreaterThan(tuft.leaves.length * 3);
    expect(mound.whorls.length).toBe(0);
    expect(buds.whorls.length).toBeGreaterThan(5);
    expect(Math.max(...buds.whorls.map((w) => w.open))).toBeLessThan(0.1);
    expect(bloom.whorls.length).toBeGreaterThanOrEqual(buds.whorls.length);
  });

  it('is a tier-3 medium shrub of the scrub and the terrace beds, golden, visited by pollinators', () => {
    const def = getSpecies('jerusalem-sage')!;
    expect(def.size).toEqual({ w: 120, h: 160 });
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#e6c040');
    expect(def.description.length).toBeLessThan(80);
  });

  it('never grows out of the sea: of the rock only the bastion’s ledge, and scrub and terrace slots to fit (ADR 0383)', () => {
    expect(jerusalemSage.sites).toEqual(['ledge']);
    const fits = COAST_SLOTS.filter((s) => isCompatible(jerusalemSage, s)).map((s) => s.id);
    expect(fits.sort()).toEqual(['low-3', 'low-4', 'mid-1', 'scrub-1', 'scrub-3', 'shelf-1', 'top-1', 'top-2']);
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('jerusalem-sage', jerusalemSage.range, COAST_FLORA)).toBe(true);
    expect(growsIn('jerusalem-sage', jerusalemSage.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('jerusalem-sage', jerusalemSage.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('jerusalem-sage', jerusalemSage.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
