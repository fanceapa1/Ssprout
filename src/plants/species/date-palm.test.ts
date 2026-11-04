import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { rachisPath } from '../../scene/palm-paint';
import { treeSuite } from '../lib/suites';
import datePalm, { datePalmArrivals, planDatePalm } from './date-palm';

treeSuite('date-palm', planDatePalm);

const plan = (seed: number) => planDatePalm(createRng(seed).fork('date-palm'));
const STEPS = 400;

describe('date palm', () => {
  it('every frond, stalk and cluster grows in from nothing, with no jump between growth steps', () => {
    for (const s of [1, 2, 3]) {
      const p = plan(s);
      const marks: [string, (g: number) => number][] = [
        ['trunk', (g) => datePalmArrivals(g).trunk],
        ['mature', (g) => datePalmArrivals(g).mature],
        ['ripe', (g) => datePalmArrivals(g).ripe],
        ...p.fronds.map((f) => [`frond ${f.id}`, (g: number) => datePalmArrivals(g).frond(f)] as [string, (g: number) => number]),
        ...p.clusters.map((c) => [`stalk ${c.id}`, (g: number) => datePalmArrivals(g).stalk(c)] as [string, (g: number) => number]),
        ...p.clusters.map((c) => [`fruit ${c.id}`, (g: number) => datePalmArrivals(g).fruit(c)] as [string, (g: number) => number]),
      ];
      for (const [name, k] of marks) {
        expect(k(0), name).toBe(0);
        expect(k(1), name).toBeGreaterThan(0.99);
        let prev = 0;
        for (let i = 1; i <= STEPS; i++) {
          const v = k(i / STEPS);
          expect(Math.abs(v - prev), name).toBeLessThan(0.05);
          prev = v;
        }
      }
    }
  });

  it('is a fan of fronds from the ground while young, then the trunk rises, then the dates hang', () => {
    const p = plan(1);
    const young = datePalmArrivals(0.28);
    expect(young.trunk).toBe(0);
    expect(p.fronds.filter((f) => f.crown === 0 && young.frond(f) > 0.3).length).toBeGreaterThanOrEqual(3);
    for (const c of p.clusters) expect(datePalmArrivals(0.74).stalk(c)).toBe(0);
    expect(datePalmArrivals(0.7).trunk).toBe(1);
  });

  it('carries a crown of 22–27 fronds, a few dry gold at the bottom, and offshoots at its foot', () => {
    for (let s = 1; s <= 12; s++) {
      const p = plan(s);
      const crown = p.fronds.filter((f) => f.crown === 0);
      expect(crown.length).toBeGreaterThanOrEqual(22);
      expect(crown.length).toBeLessThanOrEqual(27);
      for (const f of crown.filter((f) => f.dry > 0)) expect(f.age).toBeGreaterThan(0.9);
      expect(p.offshoots.length).toBeGreaterThanOrEqual(1);
      expect(p.clusters.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every full-grown frond with its leaflets inside the box, clear of its sides and top', () => {
    for (let s = 1; s <= 12; s++) {
      const p = plan(s);
      for (const b of p.tree.branches.slice(1, 1 + p.fronds.length)) {
        for (const q of b.pts.slice(1)) {
          expect(q.x).toBeGreaterThan(8);
          expect(q.x).toBeLessThan(datePalm.size.w - 8);
          expect(q.y).toBeGreaterThan(8);
        }
      }
    }
  });

  it('arches a rachis toward the ground, never past straight down', () => {
    const path = rachisPath({ from: { x: 0, y: 0 }, heading: 0, length: 100, bend: 3, side: 1 });
    expect(path.at(-1)!.y).toBeGreaterThan(20);
    for (let i = 1; i < path.length; i++) expect(path[i]!.x).toBeGreaterThanOrEqual(path[i - 1]!.x - 1e-9);
  });
});
