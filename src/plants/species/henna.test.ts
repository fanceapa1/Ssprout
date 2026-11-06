import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { smallSuite } from '../lib/suites';
import henna, { buildHenna, hennaReach, poseHenna, type HennaPose } from './henna';

smallSuite('henna');

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: HennaPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const t of [...pose.twigs, ...pose.stalks]) {
    let len = 0;
    for (let i = 1; i < t.pts.length; i++) len += Math.hypot(t.pts[i]!.x - t.pts[i - 1]!.x, t.pts[i]!.y - t.pts[i - 1]!.y);
    const tip = t.pts[t.pts.length - 1]!;
    out.set(t.id, { size: Math.max(len, t.width), pts: [t.pts[0]!.x, t.pts[0]!.y, tip.x, tip.y, t.width] });
  }
  for (const m of pose.masses) out.set(m.id, { size: m.rx * 2 * m.alpha, pts: [m.at.x, m.at.y, m.rx * m.alpha, m.ry * m.alpha] });
  for (const l of pose.leaves) out.set(l.id, { size: l.length * l.alpha, pts: [l.at.x, l.at.y, l.at.x + Math.cos(l.angle) * l.length, l.at.y + Math.sin(l.angle) * l.length, l.width] });
  for (const f of pose.florets) out.set(f.id, { size: f.radius * 2 * f.alpha, pts: [f.at.x, f.at.y, f.radius, f.open * f.radius] });
  for (const c of pose.capsules) out.set(c.id, { size: c.radius * 2 * c.alpha, pts: [c.at.x, c.at.y, c.radius] });
  return out;
}

const build = (seed: number) => buildHenna(createRng(seed).fork('henna'));

describe('henna', () => {
  const size = Math.max(henna.size.w, henna.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 4, 9]) {
      const plant = build(seed);
      let prev = marks(poseHenna(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseHenna(plant, g));
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
  });

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = henna.size;
    const left = -w * henna.anchor.x;
    const top = -h * henna.anchor.y;
    for (let seed = 1; seed <= 24; seed++) {
      for (const q of hennaReach(build(seed))) {
        expect(q.x, `seed ${seed}`).toBeGreaterThan(left + 3);
        expect(q.x, `seed ${seed}`).toBeLessThan(left + w - 3);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(top + 3);
        expect(q.y, `seed ${seed}`).toBeLessThan(top + h);
      }
    }
  });

  it('is a much-branched dome of opposite leaf pairs, frothing with cream sprays and a few capsules', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = build(seed);
      const pose = poseHenna(plant, 1);
      const mains = plant.branches.filter((b) => !b.parent);
      expect(mains.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      expect(plant.branches.length - mains.length, `seed ${seed}`).toBeGreaterThanOrEqual(12);
      // every leaf has its partner across the twig
      const ids = new Set(pose.leaves.map((l) => l.id));
      for (const id of ids) if (id.endsWith('a')) expect(ids.has(`${id.slice(0, -1)}b`), id).toBe(true);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThan(250);
      const sprays = plant.branches.filter((b) => b.spray).length;
      expect(sprays, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      const open = pose.florets.filter((f) => f.open > 0.99);
      expect(open.length, `seed ${seed}`).toBeGreaterThan(60);
      expect(pose.florets.length - open.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(pose.capsules.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      // the sprays rise above the leaves
      const leafTop = Math.min(...pose.leaves.map((l) => l.at.y));
      expect(Math.min(...pose.florets.map((f) => f.at.y)), `seed ${seed}`).toBeLessThan(leafTop);
    }
  });

  it('grows twigs, then leaf pairs, then raises the sprays, then opens the flowers', () => {
    const plant = build(2);
    const twiggy = poseHenna(plant, 0.26);
    expect(twiggy.twigs.length).toBeGreaterThan(4);
    expect(twiggy.leaves.length).toBeLessThan(twiggy.twigs.length * 4);
    expect(twiggy.florets.length).toBe(0);
    const leafy = poseHenna(plant, 0.55);
    expect(leafy.leaves.length).toBeGreaterThan(200);
    expect(leafy.florets.length).toBe(0);
    const budding = poseHenna(plant, 0.72);
    expect(budding.florets.length).toBeGreaterThan(20);
    expect(budding.florets.every((f) => f.open < 0.05)).toBe(true);
    const full = poseHenna(plant, 1);
    expect(full.florets.filter((f) => f.open > 0.99).length).toBeGreaterThan(40);
  });

  it('is a cultivated oasis shrub, cream, visited by bees', () => {
    const def = getSpecies('henna')!;
    expect(def.tier).toBe(2);
    expect(def.sizeClass).toBe('medium');
    expect(def.habitats).toEqual(['meadow', 'back']);
    expect(def.range).toEqual({ realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] });
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#f1e2bf');
  });
});
