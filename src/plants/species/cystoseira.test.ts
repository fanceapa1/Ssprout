import { describe, expect, it } from 'vitest';
import { compatibleSlots } from '../../core/placement';
import { createRng } from '../../core/rng';
import { getScenery } from '../../scenery/registry';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import cystoseira, { cystoseiraReach, planCystoseira, poseCystoseira, type CystoseiraPose } from './cystoseira';

smallSuite('cystoseira');

const plan = (seed: number) => planCystoseira(createRng(seed).fork('cystoseira'));

type Mark = { size: number; pts: number[] };

function marks(pose: CystoseiraPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const b of pose.branches) {
    const tip = b.pts[b.pts.length - 1]!;
    const len = Math.hypot(tip.x - b.pts[0]!.x, tip.y - b.pts[0]!.y);
    out.set(b.id, { size: Math.max(len, ...b.widths), pts: [b.pts[0]!.x, b.pts[0]!.y, tip.x, tip.y, Math.max(...b.widths)] });
    if (b.fertile) out.set(`${b.id}f`, { size: 3 * b.fertile.k, pts: [b.fertile.at.x, b.fertile.at.y, 3 * b.fertile.k] });
    b.bladders.forEach((bl, i) => out.set(`${b.id}b${i}`, { size: bl.r * 2, pts: [bl.at.x, bl.at.y, bl.r] }));
  }
  for (const s of pose.stones) out.set(`stone${s.seed}`, { size: s.rx * 2 * s.k, pts: [s.x, s.y, s.rx * s.k] });
  return out;
}

describe('cystoseira', () => {
  const size = Math.max(cystoseira.size.w, cystoseira.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 4, 9]) {
      const p = plan(seed);
      let prev = marks(poseCystoseira(p, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseCystoseira(p, g));
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
    const { w, h } = cystoseira.size;
    const left = -w * cystoseira.anchor.x;
    const top = -h * cystoseira.anchor.y;
    for (let seed = 1; seed <= 30; seed++) {
      const pts = cystoseiraReach(plan(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h - 1);
    }
  });

  it('is a finely forked bush: a stalk, four levels of branches, a rounded canopy wider than tall', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseCystoseira(plan(seed), 1);
      const levels = [0, 1, 2, 3].map((l) => pose.branches.filter((b) => b.level === l && b.id.startsWith('b0.')).length);
      expect(levels[0], `seed ${seed}`).toBe(1);
      expect(levels[1], `seed ${seed}`).toBeGreaterThanOrEqual(8);
      expect(levels[2], `seed ${seed}`).toBeGreaterThan(levels[1]!);
      expect(levels[3], `seed ${seed}`).toBeGreaterThan(levels[2]!);
      const main = pose.branches.filter((b) => b.id.startsWith('b0.'));
      const xs = main.flatMap((b) => b.pts.map((q) => q.x));
      const ys = main.flatMap((b) => b.pts.map((q) => q.y));
      expect(Math.max(...xs) - Math.min(...xs), `seed ${seed}`).toBeGreaterThan((Math.max(...ys) - Math.min(...ys)) * 1.1);
      expect(pose.stones.length, `seed ${seed}`).toBe(3);
    }
  });

  it('shows air bladders and, only near full growth, swollen fertile tips', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = plan(seed);
      const full = poseCystoseira(p, 1);
      expect(full.branches.flatMap((b) => b.bladders).length, `seed ${seed}`).toBeGreaterThan(3);
      expect(full.branches.filter((b) => b.fertile).length, `seed ${seed}`).toBeGreaterThan(5);
      expect(poseCystoseira(p, 0.75).branches.filter((b) => b.fertile).length, `seed ${seed}`).toBe(0);
    }
  });

  it('grows a few short fronds on a stone, then a small tuft, then the full bush', () => {
    const p = plan(2);
    const n = (g: number) => poseCystoseira(p, g).branches.length;
    const height = (g: number) =>
      Math.max(0, ...poseCystoseira(p, g).branches.filter((b) => b.id.startsWith('b0.')).map((b) => -Math.min(...b.pts.map((q) => q.y))));
    expect(n(0.1)).toBeGreaterThan(0);
    expect(n(0.1)).toBeLessThan(14);
    expect(n(0.5)).toBeGreaterThan(n(0.1));
    expect(n(1)).toBeGreaterThan(n(0.5));
    expect(n(0.5)).toBeLessThan(n(1) * 0.75);
    expect(height(0.1)).toBeLessThan(height(1) * 0.4);
    expect(poseCystoseira(p, 0.1).stones.length).toBe(1);
  });

  it('is a tier-2 medium water alga under the surface: no rim light, not visited by bees', () => {
    expect(cystoseira.tier).toBe(2);
    expect(cystoseira.sizeClass).toBe('medium');
    expect(cystoseira.habitats).toEqual(['water']);
    expect(cystoseira.rimLight).toBe(false);
    expect(cystoseira.pollinators).toBe(false);
    expect(cystoseira.description.length).toBeLessThan(80);
  });

  it('is offered by the coast only, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(cystoseira.range).toEqual({ realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] });
    expect(growsIn('cystoseira', cystoseira.range, getScenery('coast').flora)).toBe(true);
    for (const id of ['japanese-garden', 'waterfall', 'oasis'] as const) expect(growsIn('cystoseira', cystoseira.range, getScenery(id).flora), id).toBe(false);
  });

  it("fits the coast's medium and large shallows and its medium rock pool", () => {
    const ids = compatibleSlots(cystoseira, getScenery('coast').geometry.slots, []).map((o) => o.slot.id);
    expect(ids).toEqual(['shallows-1', 'shallows-2', 'shallows-4', 'shallows-6', 'pool-2']);
  });
});
