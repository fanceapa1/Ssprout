import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { fallenShape, leafletBlade, prickleShape, roseShape } from '../lib/damask-rose-paint';
import { shrubSuite } from '../lib/suites';
import damaskRose, { buildDamaskRose, poseDamaskRose, type DamaskRosePose } from './damask-rose';

shrubSuite('damask-rose', buildDamaskRose, { habitats: ['meadow', 'back'], sizeClass: 'large' });

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: DamaskRosePose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const c of pose.canes) {
    let len = 0;
    for (let i = 1; i < c.pts.length; i++) len += Math.hypot(c.pts[i]!.x - c.pts[i - 1]!.x, c.pts[i]!.y - c.pts[i - 1]!.y);
    const tip = c.pts[c.pts.length - 1]!;
    out.set(c.id, { size: Math.max(len, c.width), pts: [c.pts[0]!.x, c.pts[0]!.y, tip.x, tip.y, c.width] });
  }
  for (const k of pose.prickles) out.set(k.id, { size: k.length, pts: [k.at.x, k.at.y, k.length] });
  for (const l of pose.leaves) out.set(l.id, { size: l.length * l.alpha, pts: [l.at.x, l.at.y, l.at.x + Math.cos(l.angle) * l.length, l.at.y + Math.sin(l.angle) * l.length, l.width] });
  for (const f of pose.flowers) out.set(f.id, { size: f.radius * 2 * f.alpha, pts: [f.at.x, f.at.y, f.radius, f.open * f.radius, f.rot * f.radius] });
  return out;
}

const build = (seed: number) => buildDamaskRose(createRng(seed).fork('damask-rose'));

describe('damask-rose', () => {
  const size = Math.max(damaskRose.size.w, damaskRose.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 3, 8]) {
      const plant = build(seed);
      let prev = marks(poseDamaskRose(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseDamaskRose(plant, g));
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
    const { w, h } = damaskRose.size;
    const left = -w * damaskRose.anchor.x;
    const top = -h * damaskRose.anchor.y;
    for (let seed = 1; seed <= 16; seed++) {
      const plant = build(seed);
      const pose = poseDamaskRose(plant, 1);
      const pts = [
        ...pose.canes.flatMap((c) => c.pts),
        ...pose.prickles.flatMap((k) => prickleShape(k)),
        ...pose.leaves.flatMap((l) => leafletBlade(l, createRng(l.seed), l.shade).outline),
        ...pose.flowers.flatMap((f) => {
          const s = roseShape(f);
          return [...s.rings.flat(2), ...s.lip.flat(), ...s.bud, ...s.sepals.flat()];
        }),
        ...plant.fallen.flatMap((f) => fallenShape(f)),
      ];
      for (const q of pts) {
        expect(q.x, `seed ${seed}`).toBeGreaterThan(left + 3);
        expect(q.x, `seed ${seed}`).toBeLessThan(left + w - 3);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(top + 3);
        expect(q.y, `seed ${seed}`).toBeLessThan(top + h);
      }
    }
  });

  it('is a loose arching mound: canes from one crown that rise, then bow over', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseDamaskRose(build(seed), 1);
      const canes = pose.canes.filter((c) => c.id.startsWith('cane-'));
      expect(canes.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      const feet = canes.map((c) => c.pts[0]!.x);
      expect(Math.max(...feet) - Math.min(...feet), `seed ${seed}`).toBeLessThan(20);
      // the canes arch: each tip turns down from where it rose
      for (const c of canes) {
        const n = c.pts.length;
        const tipDir = Math.atan2(c.pts[n - 1]!.y - c.pts[n - 2]!.y, c.pts[n - 1]!.x - c.pts[n - 2]!.x);
        expect(Math.abs(Math.cos(tipDir)), `seed ${seed} ${c.id}`).toBeGreaterThan(0.5);
      }
      const tips = canes.map((c) => c.pts[c.pts.length - 1]!.x);
      expect(Math.min(...tips), `seed ${seed}`).toBeLessThan(-30);
      expect(Math.max(...tips), `seed ${seed}`).toBeGreaterThan(30);
      expect(pose.prickles.length, `seed ${seed}`).toBeGreaterThan(60);
    }
  });

  it('carries leaves of five or seven leaflets and loose clusters of cups and buds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = build(seed);
      const pose = poseDamaskRose(plant, 1);
      const perLeaf = new Map<string, number>();
      for (const l of pose.leaves) {
        const leaf = l.id.split('/')[0]!;
        perLeaf.set(leaf, (perLeaf.get(leaf) ?? 0) + 1);
      }
      for (const [leaf, n] of perLeaf) expect([5, 7], `seed ${seed} ${leaf}`).toContain(n);
      expect(plant.flowers.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      const open = pose.flowers.filter((f) => f.open > 0.99);
      expect(open.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(pose.flowers.length - open.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(plant.fallen.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('grows canes, then leaves, then buds, then opens the cups, and drops petals last', () => {
    const plant = build(2);
    const early = poseDamaskRose(plant, 0.3);
    expect(early.canes.length).toBeGreaterThan(4);
    expect(early.flowers.length).toBe(0);
    const leafy = poseDamaskRose(plant, 0.6);
    expect(leafy.leaves.length).toBeGreaterThan(200);
    expect(leafy.flowers.every((f) => f.open === 0)).toBe(true);
    expect(leafy.fallen).toBe(0);
    const full = poseDamaskRose(plant, 1);
    expect(full.flowers.some((f) => f.open > 0.99)).toBe(true);
    expect(full.fallen).toBe(1);
  });

  it('is cultivated in North Africa, pink, and visited by bees', () => {
    const def = getSpecies('damask-rose')!;
    expect(def.range).toEqual({ realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] });
    expect(def.pollinators).toBe(true);
    expect(def.bloomColor).toBe('#e2899b');
    expect(def.description.length).toBeLessThan(80);
  });
});
