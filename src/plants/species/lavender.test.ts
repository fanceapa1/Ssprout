import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { growsIn, type SceneryBiome } from '../flora';
import { smallSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import lavender, { buildLavender, lavenderReach, poseLavender, type LavenderPose } from './lavender';

smallSuite('lavender');

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: LavenderPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const r of [...pose.leaves, ...pose.stems, ...pose.axes]) {
    const tip = r.pts[r.pts.length - 1]!;
    const len = Math.hypot(tip.x - r.pts[0]!.x, tip.y - r.pts[0]!.y);
    out.set(r.id, { size: Math.max(len, r.width), pts: [r.pts[0]!.x, r.pts[0]!.y, tip.x, tip.y, r.width] });
  }
  for (const b of [...pose.patches, ...pose.hazes]) out.set(b.id, { size: b.rx * 2 * b.alpha, pts: [b.at.x, b.at.y, b.rx * b.alpha, b.ry * b.alpha] });
  for (const f of pose.florets) out.set(f.id, { size: f.rx * 2 * f.alpha, pts: [f.at.x, f.at.y, f.rx, f.open] });
  return out;
}

const build = (seed: number) => buildLavender(createRng(seed).fork('lavender'));

describe('lavender', () => {
  const size = Math.max(lavender.size.w, lavender.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseLavender(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseLavender(plant, g));
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
  }, 60_000);

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = lavender.size;
    const left = -w * lavender.anchor.x;
    const top = -h * lavender.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = lavenderReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 3);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 3);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 3);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('is a low leafy dome under many upright spikes of whorled flowers with dark tip buds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseLavender(build(seed), 1);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThan(150);
      expect(pose.stems.length, `seed ${seed}`).toBeGreaterThanOrEqual(46);
      const leafTop = Math.min(...pose.leaves.flatMap((l) => l.pts.map((q) => q.y)));
      const spikeTop = Math.min(...pose.axes.flatMap((a) => a.pts.map((q) => q.y)));
      expect(-spikeTop, `seed ${seed}`).toBeGreaterThan(-leafTop * 2);
      expect(pose.florets.filter((f) => f.open > 0.5).length, `seed ${seed}`).toBeGreaterThan(400);
      const tips = pose.florets.filter((f) => f.open < 0.7);
      expect(tips.length, `seed ${seed}`).toBeGreaterThan(15);
    }
  });

  it('grows a grey tuft, then a leafy dome, then the dome in full flower', () => {
    const plant = build(2);
    const tuft = poseLavender(plant, 0.22);
    const dome = poseLavender(plant, 0.5);
    const bloom = poseLavender(plant, 1);
    const reachX = (p: LavenderPose) => Math.max(...p.leaves.flatMap((l) => l.pts.map((q) => Math.abs(q.x))));
    expect(tuft.leaves.length).toBeGreaterThan(10);
    expect(reachX(tuft)).toBeLessThan(reachX(dome) * 0.75);
    expect(tuft.stems.length + tuft.florets.length).toBe(0);
    expect(dome.florets.length).toBe(0);
    expect(dome.stems.length).toBeGreaterThan(0);
    expect(bloom.florets.length).toBeGreaterThan(poseLavender(plant, 0.7).florets.length / 2);
    expect(bloom.hazes.length).toBeGreaterThan(0);
  });

  it('is a tier-2 medium garden plant of the terrace and path, violet, visited by bees', () => {
    const def = getSpecies('lavender')!;
    expect(def.tier).toBe(2);
    expect(def.sizeClass).toBe('medium');
    expect(def.size).toEqual({ w: 120, h: 160 });
    expect(def.habitats).toEqual(['meadow', 'path']);
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#8a78b8');
  });

  it('is offered by a Mediterranean garden, not by the Japanese garden, the waterfall or the oasis', () => {
    const med: SceneryBiome = { realm: 'mediterranean', biomes: ['coast', 'garden'], climate: 'warm-temperate', cultivated: true };
    expect(growsIn('lavender', lavender.range, med)).toBe(true);
    expect(growsIn('lavender', lavender.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('lavender', lavender.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('lavender', lavender.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
