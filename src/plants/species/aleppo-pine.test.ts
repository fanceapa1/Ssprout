import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { growsIn } from '../flora';
import { treeSuite } from '../lib/suites';
import { getScenery } from '../../scenery/registry';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { fitsSize } from '../types';
import pine, { aleppoArrivals, planAleppoPine } from './aleppo-pine';
import blackPine from './black-pine';

treeSuite('aleppo-pine', planAleppoPine);

const plan = (seed: number) => planAleppoPine(createRng(seed).fork('aleppo-pine'));
const STEPS = 400;

describe('aleppo pine', () => {
  it('stands on one slender, leaning trunk that forks high into three or four limbs', () => {
    for (let s = 1; s <= 12; s++) {
      const p = plan(s);
      const trunk = p.tree.branches.find((b) => b.parent < 0)!;
      expect(p.tree.branches.filter((b) => b.parent < 0)).toHaveLength(1);
      expect(trunk.len, `seed ${s}`).toBeGreaterThan(pine.size.h * 0.4);
      expect(trunk.w0 / trunk.len, `seed ${s}`).toBeLessThan(0.07);
      const tip = trunk.pts[trunk.pts.length - 1]!;
      // it leans toward its lean
      expect(Math.sign(tip.x - trunk.pts[0]!.x), `seed ${s}`).toBe(p.lean);
      const limbs = p.tree.branches.filter((b) => b.tag === 'limb');
      expect(limbs.length).toBeGreaterThanOrEqual(3);
      expect(limbs.length).toBeLessThanOrEqual(4);
      for (const l of limbs) expect(l.attach, `seed ${s}`).toBeGreaterThan(0.55);
    }
  });

  it('leans the way a scenery asks', () => {
    expect(planAleppoPine(createRng(4).fork('x'), { lean: 1 }).lean).toBe(1);
    expect(planAleppoPine(createRng(4).fork('x'), { lean: -1 }).lean).toBe(-1);
  });

  it('carries a light, broad crown of separate tufts, inside the box', () => {
    for (let s = 1; s <= 12; s++) {
      const { tufts } = plan(s);
      expect(tufts.length, `seed ${s}`).toBeGreaterThan(60);
      const x0 = Math.min(...tufts.map((t) => t.x - t.r));
      const x1 = Math.max(...tufts.map((t) => t.x + t.r));
      const y0 = Math.min(...tufts.map((t) => t.y - t.r));
      const y1 = Math.max(...tufts.map((t) => t.y + t.r));
      expect(x0).toBeGreaterThan(0);
      expect(x1).toBeLessThan(pine.size.w);
      expect(y0).toBeGreaterThan(0);
      // the crown sits high: the lower trunk stays bare
      expect(y1, `seed ${s}`).toBeLessThan(pine.size.h * 0.8);
      expect(x1 - x0, `seed ${s}`).toBeGreaterThan(pine.size.w * 0.5);
    }
  });

  it('bears small cones, some old and grey, pointing back along their branches', () => {
    for (let s = 1; s <= 6; s++) {
      const { cones } = plan(s);
      expect(cones.length, `seed ${s}`).toBeGreaterThan(4);
      expect(cones.length, `seed ${s}`).toBeLessThan(60);
      for (const c of cones) expect(Math.sin(c.angle), `seed ${s}`).toBeGreaterThan(-0.5);
    }
    const all = [1, 2, 3, 4, 5, 6].flatMap((s) => plan(s).cones);
    expect(all.some((c) => c.old)).toBe(true);
    expect(all.some((c) => !c.old)).toBe(true);
  });

  it('grows in order: the seedling brush, the sapling whorls shed, the crown, then cones', () => {
    const p = plan(1);
    const at = aleppoArrivals;
    const tuft = p.tufts[0]!;
    const cone = p.cones[0]!;
    const whorl = p.tree.branches.find((b) => b.tag === 'whorl')!;
    expect(at(0.1).young).toBeGreaterThan(0.95);
    expect(at(0.08).tuft(tuft)).toBe(0);
    expect(at(0.3).whorl(whorl)).toBe(1);
    expect(at(0.9).whorl(whorl)).toBe(0);
    expect(at(0.9).young).toBe(0);
    expect(at(0.75).cone(cone)).toBe(0);
    expect(at(1).cone(cone)).toBeGreaterThan(0.99);
    expect(at(1).tuft(tuft)).toBeGreaterThan(0.99);
    expect(at(0.25).age).toBe(0);
    expect(at(1).age).toBe(1);
  });

  it('every mark grows in from nothing, with no jump between growth steps', () => {
    const p = plan(2);
    const marks: [string, (g: number) => number][] = [
      ['age', (g) => aleppoArrivals(g).age],
      ...p.tufts.filter((_, i) => i % 5 === 0).map((t) => [`tuft ${t.id}`, (g: number) => aleppoArrivals(g).tuft(t)] as [string, (g: number) => number]),
      ...p.cones.map((c) => [`cone ${c.id}`, (g: number) => aleppoArrivals(g).cone(c)] as [string, (g: number) => number]),
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
    let prev = 0;
    for (let i = 1; i <= STEPS; i++) {
      const v = aleppoArrivals(i / STEPS).young;
      expect(Math.abs(v - prev), 'young').toBeLessThan(0.05);
      prev = v;
    }
  });

  it('is offered by the coast only: not the Japanese garden, the waterfall or the Saharan oasis', () => {
    expect(growsIn('aleppo-pine', pine.range, getScenery('coast').flora)).toBe(true);
    expect(growsIn('aleppo-pine', pine.range, getScenery('japanese-garden').flora)).toBe(false);
    expect(growsIn('aleppo-pine', pine.range, getScenery('waterfall').flora)).toBe(false);
    expect(growsIn('aleppo-pine', pine.range, getScenery('oasis').flora)).toBe(false);
    // never in one garden with the black pine
    for (const id of ['coast', 'japanese-garden', 'waterfall', 'oasis'] as const) {
      const flora = getScenery(id).flora;
      expect(growsIn('aleppo-pine', pine.range, flora) && growsIn('black-pine', blackPine.range, flora), id).toBe(false);
    }
  });

  it('has a tree slot on the coast in its habitat', () => {
    const fits = COAST_SLOTS.filter((s) => pine.habitats.includes(s.habitat) && fitsSize(pine.sizeClass, s.maxSize)).map((s) => s.id);
    expect(fits).toEqual(['scrub-1']);
  });
});
