import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { driftShape, floretShape, fruitOutline, leafOval, thornShape } from '../lib/jujube-paint';
import { shrubSuite } from '../lib/suites';
import jujube, { buildJujube, poseJujube, type JujubePose } from './jujube';

shrubSuite('jujube', buildJujube, { habitats: ['shore', 'back'], sizeClass: 'large' });

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: JujubePose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const s of pose.stems) {
    let len = 0;
    for (let i = 1; i < s.pts.length; i++) len += Math.hypot(s.pts[i]!.x - s.pts[i - 1]!.x, s.pts[i]!.y - s.pts[i - 1]!.y);
    const tip = s.pts[s.pts.length - 1]!;
    out.set(s.id, { size: Math.max(len, s.width), pts: [s.pts[0]!.x, s.pts[0]!.y, tip.x, tip.y, s.width] });
  }
  for (const t of pose.thorns) out.set(t.id, { size: t.length, pts: [t.at.x, t.at.y, t.length] });
  for (const l of pose.leaves) out.set(l.id, { size: l.length * l.alpha, pts: [l.at.x, l.at.y, l.length, l.width] });
  for (const f of pose.flowers) out.set(f.id, { size: f.radius * 2 * f.alpha, pts: [f.at.x, f.at.y, f.radius] });
  for (const f of pose.fruits) out.set(f.id, { size: f.radius * 2 * f.alpha, pts: [f.at.x, f.at.y, f.radius, f.ripe * 10] });
  return out;
}

const build = (seed: number) => buildJujube(createRng(seed).fork('jujube'));

describe('jujube', () => {
  const size = Math.max(jujube.size.w, jujube.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 3, 8]) {
      const plant = build(seed);
      let prev = marks(poseJujube(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseJujube(plant, g));
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
    const { w, h } = jujube.size;
    const left = -w * jujube.anchor.x;
    const top = -h * jujube.anchor.y;
    for (let seed = 1; seed <= 16; seed++) {
      const plant = build(seed);
      const pose = poseJujube(plant, 1);
      const pts = [
        ...pose.stems.flatMap((s) => s.pts),
        ...pose.thorns.flatMap((t) => thornShape(t)),
        ...pose.leaves.flatMap((l) => leafOval(l)),
        ...pose.fruits.flatMap((f) => fruitOutline(f)),
        ...driftShape(plant.foot, plant.drift.half, plant.drift.height, plant.drift.skew),
      ];
      for (const q of pts) {
        expect(q.x, `seed ${seed}`).toBeGreaterThan(left + 3);
        expect(q.x, `seed ${seed}`).toBeLessThan(left + w - 3);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(top + 3);
        expect(q.y, `seed ${seed}`).toBeLessThan(top + h);
      }
    }
  });

  it('is a low, wide, tangled mound of zigzag stems with paired thorns', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = build(seed);
      const pose = poseJujube(plant, 1);
      const all = pose.stems.flatMap((s) => s.pts);
      const xs = all.map((q) => q.x);
      const height = -Math.min(...all.map((q) => q.y));
      const width = Math.max(...xs) - Math.min(...xs);
      expect(width / height, `seed ${seed}`).toBeGreaterThan(1.2);
      expect(height, `seed ${seed}`).toBeLessThan(135);
      expect(pose.stems.length, `seed ${seed}`).toBeGreaterThan(100);
      // zigzag: along a main stem the turn at each node mostly flips side
      const mains = plant.branches.filter((b) => b.order === 0 && b.pts.length > 5);
      let flips = 0;
      let turns = 0;
      for (const b of mains) {
        const head = b.pts.slice(1).map((q, i) => Math.atan2(q.y - b.pts[i]!.y, q.x - b.pts[i]!.x));
        const turn = head.slice(1).map((a, i) => Math.atan2(Math.sin(a - head[i]!), Math.cos(a - head[i]!)));
        for (let i = 1; i < turn.length; i++, turns++) if (Math.sign(turn[i]!) !== Math.sign(turn[i - 1]!)) flips++;
      }
      expect(flips / turns, `seed ${seed}`).toBeGreaterThan(0.7);
      // thorns come in pairs: one straight spine and one short hook at a node
      const straight = pose.thorns.filter((t) => !t.hooked).length;
      expect(straight, `seed ${seed}`).toBe(pose.thorns.length - straight);
      expect(straight, `seed ${seed}`).toBeGreaterThan(200);
    }
  });

  it('carries small leaves and many small fruit, most of them ripe red', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseJujube(build(seed), 1);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThan(250);
      expect(Math.max(...pose.leaves.map((l) => l.length)), `seed ${seed}`).toBeLessThan(6);
      expect(pose.fruits.length, `seed ${seed}`).toBeGreaterThanOrEqual(35);
      expect(Math.max(...pose.fruits.map((f) => f.radius)), `seed ${seed}`).toBeLessThan(3);
      const red = pose.fruits.filter((f) => f.ripe > 0.6).length;
      expect(red / pose.fruits.length, `seed ${seed}`).toBeGreaterThan(0.6);
      expect(pose.fruits.some((f) => f.ripe < 0.6), `seed ${seed}`).toBe(true);
      expect(pose.flowers.length, `seed ${seed}`).toBe(0);
    }
  });

  it('grows shoots, then the leafy tangle, then tiny flowers, then fruit ripening to red', () => {
    const plant = build(2);
    const shoots = poseJujube(plant, 0.3);
    expect(shoots.stems.length).toBeGreaterThan(5);
    expect(shoots.flowers.length + shoots.fruits.length).toBe(0);
    const leafy = poseJujube(plant, 0.55);
    expect(leafy.leaves.length).toBeGreaterThan(100);
    expect(leafy.fruits.length).toBe(0);
    const flowering = poseJujube(plant, 0.72);
    expect(flowering.flowers.filter((f) => f.alpha > 0.5).length).toBeGreaterThan(20);
    expect(floretShape(flowering.flowers[0]!)).toHaveLength(10);
    const setting = poseJujube(plant, 0.88);
    expect(setting.fruits.length).toBeGreaterThan(20);
    const full = poseJujube(plant, 1);
    const meanRipe = (p: JujubePose) => p.fruits.reduce((s, f) => s + f.ripe, 0) / p.fruits.length;
    expect(meanRipe(full)).toBeGreaterThan(meanRipe(setting) + 0.2);
    expect(full.drift).toBe(1);
  });

  it('is wild in North Africa, red-fruited and visited by bees', () => {
    const def = getSpecies('jujube')!;
    expect(def.range).toEqual({ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert'], climates: ['arid'] });
    expect(def.range.cultivatedIn).toBeUndefined();
    expect(def.pollinators).toBe(true);
    expect(def.description.length).toBeLessThan(80);
  });
});
