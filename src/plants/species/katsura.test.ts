import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { hexToRgb } from '../../paint/pigments';
import { heartOutline } from '../lib/katsura-paint';
import { treeSuite } from '../lib/suites';
import katsura, { katsuraArrivals, katsuraPadColour, planKatsura } from './katsura';

treeSuite('katsura', planKatsura);

const plan = (seed: number) => planKatsura(createRng(seed).fork('katsura'));
const STEPS = 400;

describe('katsura', () => {
  it('grows from a ring of several stems', () => {
    for (let s = 1; s <= 12; s++) {
      const stems = plan(s).tree.branches.filter((b) => b.parent < 0 && b.tag !== 'sucker');
      expect(stems.length).toBeGreaterThanOrEqual(4);
      const xs = stems.map((b) => b.pts[0]!.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(30);
    }
  });

  it('carries a broad crown, wider than it is tall', () => {
    const ratios: number[] = [];
    for (let s = 1; s <= 12; s++) {
      const pads = plan(s).pads;
      const w = Math.max(...pads.map((q) => q.x + q.r)) - Math.min(...pads.map((q) => q.x - q.r));
      const h = Math.max(...pads.map((q) => q.y + q.r)) - Math.min(...pads.map((q) => q.y - q.r));
      ratios.push(w / h);
      expect(w / h, `seed ${s}`).toBeGreaterThan(0.9);
      expect(w).toBeGreaterThan(katsura.size.w * 0.6);
      for (const q of pads) {
        expect(q.x - q.r).toBeGreaterThan(0);
        expect(q.x + q.r).toBeLessThan(katsura.size.w);
        expect(q.y - q.r).toBeGreaterThan(0);
      }
    }
    ratios.sort((a, b) => a - b);
    expect(ratios[6]).toBeGreaterThan(1.1);
  });

  it('every pad and leaf grows in from nothing, with no jump between growth steps', () => {
    for (const s of [1, 2, 3, 4]) {
      const p = plan(s);
      const marks: [string, (g: number) => number][] = [
        ...p.pads.map((q) => [`pad ${q.id}`, (g: number) => katsuraArrivals(g).pad(q)] as [string, (g: number) => number]),
        ...p.hearts.map((h) => [`heart ${h.id}`, (g: number) => katsuraArrivals(g).heart(h)] as [string, (g: number) => number]),
        ...p.sucker.map((h) => [`sucker ${h.id}`, (g: number) => katsuraArrivals(g).sucker(h)] as [string, (g: number) => number]),
        ...p.fallen.map((h) => [`fallen ${h.id}`, (g: number) => katsuraArrivals(g).fallen(h)] as [string, (g: number) => number]),
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

  it('masses its crown in clumps, lit on top and shaded beneath, with a few sky holes', () => {
    for (let s = 1; s <= 12; s++) {
      const p = plan(s);
      expect(p.holes.length, `seed ${s}`).toBeLessThanOrEqual(2);
      const top = Math.min(...p.pads.map((q) => q.y));
      const bottom = Math.max(...p.pads.map((q) => q.y));
      for (const h of p.holes) {
        expect(h.y).toBeLessThan((top + bottom) / 2 + 10);
        for (const q of p.pads) expect(Math.hypot(q.x - h.x, q.y - h.y)).toBeGreaterThanOrEqual(h.r);
        for (const l of p.hearts) expect(Math.hypot(l.x - h.x, l.y - h.y)).toBeGreaterThanOrEqual(h.r * 0.7);
      }
      const lit = p.pads.map((q) => q.lit);
      expect(Math.min(...lit)).toBeLessThan(-0.2);
      expect(Math.max(...lit)).toBeGreaterThan(0.2);
      for (const v of lit) expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  it('turns wine-red, then blue-green, then autumn gold', () => {
    const pad = { ...plan(1).pads[0]!, delay: 0, turn: 0.5, pink: 0 };
    const at = (g: number) => hexToRgb(katsuraPadColour(pad, g).mid);
    const young = at(0.47);
    const summer = at(0.72);
    const autumn = at(1);
    expect(young.r).toBeGreaterThan(young.g + 40);
    expect(summer.g).toBeGreaterThan(summer.r);
    expect(autumn.r).toBeGreaterThan(autumn.g);
    expect(autumn.g).toBeGreaterThan(autumn.b + 60);
  });

  it('paints its leaves as round hearts, about as wide as long', () => {
    const poly = heartOutline(0, 0, 0, 10);
    const xs = poly.map((q) => q.x);
    const ys = poly.map((q) => q.y);
    const len = Math.max(...xs) - Math.min(...xs);
    const wid = Math.max(...ys) - Math.min(...ys);
    expect(wid / len).toBeGreaterThan(0.8);
    expect(wid / len).toBeLessThan(1.2);
    // the sinus: on the axis the outline is notched in from the two lobes
    expect(Math.min(...xs)).toBeLessThan(len * 0.2);
    expect(poly.find((q) => Math.abs(q.y) < 0.01)!.x).toBeGreaterThan(Math.min(...xs));
  });
});
