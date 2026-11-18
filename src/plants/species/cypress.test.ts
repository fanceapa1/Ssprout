import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { COAST_FLORA } from '../../scenery/coast/flora';
import { COAST_SLOTS } from '../../scenery/coast/slots';
import { growsIn } from '../flora';
import { getSpecies } from '../registry';
import { fitsSize } from '../types';
import cypress, { cypressReach, planCypress, poseCypress, type CypressPose } from './cypress';

const plan = (seed: number) => planCypress(createRng(seed).fork('cypress'));

type Mark = { size: number; pts: number[] };

function marks(pose: CypressPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const s of pose.sprays) out.set(s.id, { size: s.len * s.alpha, pts: [s.base.x, s.base.y, s.len] });
  for (const c of pose.cones) out.set(c.id, { size: c.r * c.alpha, pts: [c.at.x, c.at.y, c.r] });
  out.set('tip', { size: 0, pts: [pose.tip.x, pose.tip.y, pose.y0, pose.trunkW] });
  return out;
}

describe('cypress', () => {
  it('is a tier-4 large plant of the terrace beds, with a native name and a short line', () => {
    const def = getSpecies('cypress')!;
    expect(def.tier).toBe(4);
    expect(def.sizeClass).toBe('large');
    expect(def.size).toEqual({ w: 200, h: 220 });
    expect(def.habitats).toEqual(['meadow']);
    expect(def.nativeName).toBeTruthy();
    expect(def.description.length).toBeLessThan(80);
    expect(def.pollinators).toBe(false);
  });

  it('plans deterministically from the seed, and seeds differ', () => {
    expect(plan(42)).toEqual(plan(42));
    expect(plan(43)).not.toEqual(plan(42));
  });

  it('draw consumes the species rng identically at every growth', () => {
    const after = (growth: number) => {
      const rng = createRng(5).fork('cypress');
      try {
        cypress.draw({} as never, rng, { w: 200, h: 220, growth });
      } catch {
        // the stub cannot paint; only the rng's position matters
      }
      return rng.next();
    };
    const ref = after(0);
    for (const g of [0.1, 0.5, 1]) expect(after(g)).toBe(ref);
  });

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    const lim = 220 * 0.03;
    for (const seed of [1, 4, 9]) {
      const p = plan(seed);
      let prev = marks(poseCypress(p, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseCypress(p, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(lim);
            continue;
          }
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(lim);
          expect(Math.abs(m.size - before.size), `${id} size jumped at g=${g}`).toBeLessThan(lim);
        }
        prev = cur;
      }
    }
  });

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const pts = cypressReach(plan(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(198);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(220);
    }
  });

  it('is a narrow spire: far taller than wide, on a short bare foot, a small flame already as a sapling', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = plan(seed);
      const grown = poseCypress(p, 1);
      const xs = grown.body.map((q) => q.x);
      const width = Math.max(...xs) - Math.min(...xs);
      expect((grown.y0 - grown.tip.y) / width, `seed ${seed}`).toBeGreaterThan(3.5);
      expect(220 * 0.94 - grown.y0, `seed ${seed}`).toBeGreaterThan(6);
      const sapling = poseCypress(p, 0.1);
      expect(sapling.y0 - sapling.tip.y, `seed ${seed}`).toBeGreaterThan(30);
      expect(sapling.sprays.filter((s) => s.alpha > 0.9).length).toBeGreaterThan(60);
      expect(grown.sprays.filter((s) => s.out && s.alpha > 0.9).length).toBeGreaterThanOrEqual(1);
      expect(grown.cones.every((c) => c.alpha > 0.95)).toBe(true);
    }
  });

  it('grows only in the coast terrace beds that take a large plant, never in the sea or on the beach', () => {
    const fits = COAST_SLOTS.filter((s) => cypress.habitats.includes(s.habitat) && fitsSize(cypress.sizeClass, s.maxSize));
    expect(fits.map((s) => s.id).sort()).toEqual(['mid-1', 'top-1']);
    expect(fits.some((s) => s.habitat === 'water' || s.habitat === 'shore')).toBe(false);
  });

  it('is offered by the Greek coast, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(growsIn('cypress', cypress.range, COAST_FLORA)).toBe(true);
    expect(growsIn('cypress', cypress.range, { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true })).toBe(false);
    expect(growsIn('cypress', cypress.range, { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false })).toBe(false);
    expect(growsIn('cypress', cypress.range, { realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid', cultivated: true })).toBe(false);
  });
});
