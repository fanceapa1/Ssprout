import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { growsIn } from '../flora';
import { shrubSuite } from '../lib/suites';
import { getSpecies } from '../registry';
import { fitsSize } from '../types';
import treeSpurge, { buildTreeSpurge, poseTreeSpurge, treeSpurgeReach, type TreeSpurgePose } from './tree-spurge';

shrubSuite('tree-spurge', buildTreeSpurge, { habitats: ['back'], sizeClass: 'large' });

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: TreeSpurgePose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const s of pose.stems) {
    const a = s.pts[0]!;
    const b = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(Math.hypot(b.x - a.x, b.y - a.y), s.width), pts: [a.x, a.y, b.x, b.y, s.width] });
  }
  for (const l of pose.leaves) out.set(l.id, { size: l.len * l.alpha, pts: [l.at.x, l.at.y, l.at.x + Math.cos(l.angle) * l.len, l.at.y + Math.sin(l.angle) * l.len] });
  for (const h of pose.heads) out.set(h.id, { size: h.R * 2 * h.alpha, pts: [h.at.x, h.at.y, h.R] });
  for (const m of pose.haze) out.set(m.id, { size: m.rx * m.alpha, pts: [m.cx, m.cy, m.rx, m.ry] });
  return out;
}

const build = (seed: number) => buildTreeSpurge(createRng(seed).fork('tree-spurge'));

describe('tree spurge', () => {
  const size = Math.max(treeSpurge.size.w, treeSpurge.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseTreeSpurge(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseTreeSpurge(plant, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(size * 0.03);
            continue;
          }
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(size * 0.03);
        }
        for (const [id, m] of prev) if (!cur.has(id)) expect(m.size, `${id} vanished at g=${g}`).toBeLessThan(size * 0.03);
        prev = cur;
      }
    }
  }, 60_000);

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = treeSpurge.size;
    const left = -w * treeSpurge.anchor.x;
    const top = -h * treeSpurge.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      const pts = treeSpurgeReach(build(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h);
    }
  });

  it('forks in twos: every stem that branches has exactly two children', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = build(seed);
      const kids = new Map<number, number>();
      for (const n of plant.nodes) if (n.parent >= 0) kids.set(n.parent, (kids.get(n.parent) ?? 0) + 1);
      plant.nodes.forEach((n, i) => expect(n.tip ? kids.get(i) : kids.get(i), `seed ${seed} node ${i}`).toBe(n.tip ? undefined : 2));
      expect(plant.nodes.filter((n) => n.tip).length, `seed ${seed}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('is a dome wider than its stem, with a lime head on every tip in bloom', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseTreeSpurge(build(seed), 1);
      const xs = pose.leaves.map((l) => l.at.x);
      expect(Math.max(...xs) - Math.min(...xs), `seed ${seed}`).toBeGreaterThan(130);
      expect(pose.heads.length, `seed ${seed}`).toBeGreaterThanOrEqual(20);
      expect(pose.heads.every((h) => h.alpha > 0.95)).toBe(true);
    }
  });

  it('grows a leafy fork, a leafy young dome, then the dome in lime bloom', () => {
    const plant = build(2);
    for (const g of [0.2, 0.3, 0.45]) expect(poseTreeSpurge(plant, g).leaves.filter((l) => l.alpha > 0.5).length, `g=${g}`).toBeGreaterThan(5);
    expect(poseTreeSpurge(plant, 0.5).heads.length).toBe(0);
    expect(poseTreeSpurge(plant, 0.6).leaves.length).toBeGreaterThan(150);
    expect(poseTreeSpurge(plant, 1).heads.length).toBeGreaterThan(poseTreeSpurge(plant, 0.7).heads.length);
  });

  it('is a tier-3 large shrub of the scrub, lime, visited by pollinators', () => {
    const def = getSpecies('tree-spurge')!;
    expect(def.size).toEqual({ w: 200, h: 220 });
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#c6cd5e');
    expect(def.description.length).toBeLessThan(80);
  });

  it('can grow only on the cliff top in the coast garden, never on a rock in the sea', () => {
    const fits = COAST_SLOTS.filter((s) => treeSpurge.habitats.includes(s.habitat) && fitsSize(treeSpurge.sizeClass, s.maxSize));
    expect(fits.map((s) => s.id)).toEqual(['scrub-1']);
    expect(COAST_SLOTS.filter((s) => s.id.startsWith('splash') && fitsSize(treeSpurge.sizeClass, s.maxSize))).toEqual([]);
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('tree-spurge', treeSpurge.range, COAST_FLORA)).toBe(true);
    expect(growsIn('tree-spurge', treeSpurge.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('tree-spurge', treeSpurge.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('tree-spurge', treeSpurge.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
