import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { calyxOutline } from '../lib/pomegranate-paint';
import { treeSuite } from '../lib/suites';
import pomegranate, { planPomegranate, pomegranateArrivals } from './pomegranate';

treeSuite('pomegranate', planPomegranate);

const plan = (seed: number) => planPomegranate(createRng(seed).fork('pomegranate'));
const STEPS = 400;
type Mark = [string, (g: number) => number];

describe('pomegranate', () => {
  it('grows every leaf, bud, flower and fruit in from nothing, with no jump between growth steps', () => {
    const a = pomegranateArrivals;
    for (const s of [1, 2, 3]) {
      const p = plan(s);
      const marks: Mark[] = [
        ...p.pads.map((m): Mark => [`pad ${m.id}`, (g) => a(g).pad(m)]),
        ...p.leaves.filter((_, i) => i % 7 === 0).map((m): Mark => [`leaf ${m.id}`, (g) => a(g).leaf(m)]),
        ...[...p.flowers, ...p.fruits].flatMap((m): Mark[] => [
          [`bud ${m.id}`, (g) => a(g).bud(m)],
          [`petals ${m.id}`, (g) => a(g).petals(m)],
          [`swell ${m.id}`, (g) => a(g).swell(m)],
          [`ripe ${m.id}`, (g) => a(g).ripe(m)],
        ]),
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

  it('grows wood, then leaves, then the calyx buds, then flowers, then swelling fruit', () => {
    const p = plan(1);
    const at = pomegranateArrivals;
    for (const l of p.leaves) expect(at(0.42).leaf(l)).toBe(0);
    for (const f of [...p.flowers, ...p.fruits]) {
      expect(at(0.6).bud(f)).toBe(0);
      expect(at(0.76).petals(f)).toBe(0);
      expect(at(0.78).swell(f)).toBe(0);
    }
  });

  it('carries flowers and a few crowned fruits together, all inside the box', () => {
    for (let s = 1; s <= 12; s++) {
      const p = plan(s);
      expect(p.flowers.length, `seed ${s}`).toBeGreaterThanOrEqual(6);
      expect(p.fruits.length, `seed ${s}`).toBeGreaterThanOrEqual(3);
      expect(p.fruits.length).toBeLessThanOrEqual(6);
      for (const f of p.fruits) expect(Math.sin(f.angle), 'a crown never points straight down').toBeLessThanOrEqual(0.21);
      const round = [...p.flowers.map((f) => ({ ...f.at, r: f.length })), ...p.fruits.map((f) => ({ ...f.at, r: f.r * 1.6 }))];
      for (const m of round) {
        expect(m.x - m.r).toBeGreaterThan(0);
        expect(m.x + m.r).toBeLessThan(pomegranate.size.w);
        expect(m.y - m.r).toBeGreaterThan(0);
      }
      for (const l of p.leaves) {
        expect(l.x).toBeGreaterThan(8);
        expect(l.x).toBeLessThan(pomegranate.size.w - 8);
        expect(l.y).toBeGreaterThan(8);
      }
    }
  });

  it('opens the calyx teeth as the flower bursts out', () => {
    const spread = (o: number) => Math.max(...calyxOutline({ x: 0, y: 0 }, 0, 10, o).map((q) => Math.abs(q.y)));
    expect(spread(1)).toBeGreaterThan(spread(0));
  });
});
