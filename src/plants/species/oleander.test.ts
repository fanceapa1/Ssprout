import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { knifeBlade, pinwheelShape } from '../lib/oleander-paint';
import { shrubSuite } from '../lib/suites';
import oleander, { buildOleander, poseOleander, type OleanderPose } from './oleander';

shrubSuite('oleander', buildOleander, { habitats: ['shore', 'back'], sizeClass: 'large' });

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: OleanderPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const c of pose.stems) {
    let len = 0;
    for (let i = 1; i < c.pts.length; i++) len += Math.hypot(c.pts[i]!.x - c.pts[i - 1]!.x, c.pts[i]!.y - c.pts[i - 1]!.y);
    const tip = c.pts[c.pts.length - 1]!;
    out.set(c.id, { size: Math.max(len, c.width), pts: [c.pts[0]!.x, c.pts[0]!.y, tip.x, tip.y, c.width] });
  }
  for (const l of pose.leaves) out.set(l.id, { size: l.length * l.alpha, pts: [l.at.x, l.at.y, l.at.x + Math.cos(l.angle) * l.length, l.at.y + Math.sin(l.angle) * l.length, l.width] });
  for (const f of pose.flowers) out.set(f.id, { size: f.radius * 2 * f.alpha, pts: [f.at.x, f.at.y, f.radius, f.open * f.radius, f.roll * f.radius] });
  return out;
}

const build = (seed: number) => buildOleander(createRng(seed).fork('oleander'));

describe('oleander', () => {
  const size = Math.max(oleander.size.w, oleander.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 3, 8]) {
      const plant = build(seed);
      let prev = marks(poseOleander(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseOleander(plant, g));
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
    const { w, h } = oleander.size;
    const left = -w * oleander.anchor.x;
    const top = -h * oleander.anchor.y;
    for (let seed = 1; seed <= 40; seed++) {
      const pose = poseOleander(build(seed), 1);
      const pts = [
        ...pose.stems.flatMap((c) => c.pts),
        ...pose.leaves.flatMap((l) => knifeBlade(l, createRng(l.seed), l.shade).outline),
        ...pose.flowers.flatMap((f) => {
          const s = pinwheelShape(f);
          return [...s.petals.flat(), ...s.bud];
        }),
      ];
      for (const q of pts) {
        expect(q.x, `seed ${seed}`).toBeGreaterThan(left + 3);
        expect(q.x, `seed ${seed}`).toBeLessThan(left + w - 3);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(top + 3);
        expect(q.y, `seed ${seed}`).toBeLessThan(top + h);
      }
    }
  });

  it('is an upright fountain: many stems from a narrow crown, spreading at the top', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseOleander(build(seed), 1);
      const main = pose.stems.filter((c) => c.id.startsWith('stem-') && Math.abs(c.pts[0]!.y) < 1e-6);
      expect(main.length, `seed ${seed}`).toBeGreaterThanOrEqual(11);
      const feet = main.map((c) => c.pts[0]!.x);
      const tips = main.map((c) => c.pts[c.pts.length - 1]!);
      const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
      expect(spread(feet), `seed ${seed}`).toBeLessThan(25);
      expect(spread(tips.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(spread(feet) * 4);
      expect(Math.min(...tips.map((q) => q.y)), `seed ${seed}`).toBeLessThan(-160);
    }
  });

  it('carries knife leaves in whorls of three and a cluster of pinwheels and buds at every tip', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = build(seed);
      for (const st of plant.stems) {
        expect(st.flowers.length).toBeGreaterThanOrEqual(5);
        expect(st.flowers.some((f) => f.bud)).toBe(true);
        for (const nd of st.nodes) {
          expect(nd.leaves.map((l) => l.side).sort()).toEqual([-1, 0, 1]);
          // the third leaf of a whorl points at us and is foreshortened
          for (const l of nd.leaves.filter((l) => l.side !== 0)) expect(l.length / l.width).toBeGreaterThan(4);
        }
      }
    }
  });

  it('grows stems, then leaves, then buds, then opens the pinwheels', () => {
    const plant = build(2);
    const early = poseOleander(plant, 0.3);
    expect(early.stems.length).toBeGreaterThan(5);
    expect(early.flowers.length).toBe(0);
    const leafy = poseOleander(plant, 0.6);
    expect(leafy.leaves.length).toBeGreaterThan(100);
    expect(leafy.flowers.every((f) => f.open === 0)).toBe(true);
    const full = poseOleander(plant, 1);
    const open = full.flowers.filter((f) => f.open > 0.99);
    expect(open.length).toBeGreaterThan(full.flowers.length * 0.55);
    expect(full.flowers.length - open.length).toBeGreaterThan(0);
  });

  it('grows wild by the wadis of North Africa and the Mediterranean, and keeps bees away', () => {
    const def = getSpecies('oleander')!;
    expect(def.range).toEqual({ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'wetland'], climates: ['arid', 'warm-temperate'] });
    expect(def.pollinators).toBe(false);
    expect(def.description.length).toBeLessThan(80);
  });
});
