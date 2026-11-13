import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import rockSamphire, { buildRockSamphire, poseRockSamphire, rockSamphireReach, type RockSamphirePose } from './rock-samphire';

smallSuite('rock-samphire');

type Mark = { size: number; pts: number[] };

function marks(pose: RockSamphirePose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const f of pose.fingers) {
    const o = f.geom.outline;
    const far = o[Math.floor(o.length / 2)]!;
    out.set(f.id, { size: Math.hypot(o[0]!.x - far.x, o[0]!.y - far.y) * f.alpha, pts: o.flatMap((q) => [q.x, q.y]) });
  }
  for (const s of pose.stalks) {
    const a = s.pts[0]!;
    const b = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(Math.hypot(b.x - a.x, b.y - a.y), s.width), pts: [...s.pts.flatMap((q) => [q.x, q.y]), s.width] });
  }
  for (const u of pose.umbels) out.set(u.id, { size: Math.max(u.rx, u.ry) * u.alpha, pts: [u.at.x, u.at.y, u.rx, u.ry, u.open] });
  return out;
}

const build = (seed: number) => buildRockSamphire(createRng(seed).fork('rock-samphire'));

describe('rock samphire', () => {
  const size = 70;

  it('grows continuously: no mark jumps, appears small or vanishes small', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseRockSamphire(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseRockSamphire(plant, g));
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
      const pts = rockSamphireReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + size - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + size);
    }
  });

  it('is a cushion of forked fat fingers under a row of flat umbels that rise above it', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseRockSamphire(build(seed), 1);
      expect(pose.fingers.length, `seed ${seed}`).toBeGreaterThanOrEqual(50);
      expect(pose.fingers.some((f) => f.id.split('-').length === 3)).toBe(true);
      expect(pose.umbels.length, `seed ${seed}`).toBeGreaterThanOrEqual(5);
      for (const u of pose.umbels) {
        expect(u.open).toBeGreaterThan(0.95);
        expect(u.rx).toBeGreaterThan(u.ry * 1.6);
      }
      const top = Math.min(...pose.fingers.flatMap((f) => f.geom.outline.map((q) => q.y)));
      expect(Math.min(...pose.umbels.map((u) => u.at.y)), `seed ${seed}: umbels above the cushion`).toBeLessThan(top - 6);
    }
  });

  it('grows a few fingers, then the green cushion, then the umbels', () => {
    const plant = build(2);
    const first = poseRockSamphire(plant, 0.18);
    const cushion = poseRockSamphire(plant, 0.5);
    const full = poseRockSamphire(plant, 1);
    expect(first.fingers.length).toBeGreaterThan(2);
    expect(first.fingers.length).toBeLessThan(cushion.fingers.length / 2);
    expect(first.umbels.length).toBe(0);
    expect(cushion.umbels.length).toBe(0);
    expect(full.umbels.length).toBeGreaterThan(4);
    expect(full.fingers.some((f) => f.tintK > 0.3)).toBe(true);
  });

  it('ripens: some umbels turn olive and purple, the others stay lime', () => {
    const pose = poseRockSamphire(build(3), 1);
    const ages = pose.umbels.map((u) => u.age);
    expect(Math.max(...ages)).toBeGreaterThan(0.5);
    expect(Math.min(...ages)).toBeLessThan(0.3);
  });

  it('is a tier-1 small plant of rock and shingle, lime, visited by pollinators', () => {
    const def = getSpecies('rock-samphire')!;
    expect(def.tier).toBe(1);
    expect(def.sizeClass).toBe('small');
    expect(def.size).toEqual({ w: 86, h: 86 });
    expect(def.habitats).toEqual(['rock', 'shore']);
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#cfd28a');
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('rock-samphire', rockSamphire.range, COAST_FLORA)).toBe(true);
    expect(growsIn('rock-samphire', rockSamphire.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('rock-samphire', rockSamphire.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('rock-samphire', rockSamphire.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
