import { describe, expect, it } from 'vitest';
import { compatibleSlots } from '../../core/placement';
import { createRng } from '../../core/rng';
import { getScenery } from '../../scenery/registry';
import { growsIn } from '../flora';
import { smallSuite } from '../lib/suites';
import peacocksTail, { peacocksTailReach, planPeacocksTail, posePeacocksTail, type PeacocksTailPose } from './peacocks-tail';

smallSuite('peacocks-tail');

const plan = (seed: number) => planPeacocksTail(createRng(seed).fork('peacocks-tail'));

type Mark = { size: number; pts: number[] };

function marks(pose: PeacocksTailPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const f of pose.fans) {
    const a = f.rim[0]!;
    const b = f.rim[f.rim.length - 1]!;
    const mid = f.rim[Math.floor(f.rim.length / 2)]!;
    out.set(f.id, { size: Math.hypot(b.x - a.x, b.y - a.y), pts: [f.apex.x, f.apex.y, a.x, a.y, b.x, b.y, mid.x, mid.y] });
    f.rings.forEach((r, i) => out.set(`${f.id}r${i}`, { size: r.w * 2, pts: [r.pts[0]!.x, r.pts[0]!.y, r.w] }));
  }
  if (pose.stone) out.set('stone', { size: pose.stone.rx * 2 * pose.stone.k, pts: [pose.stone.x, pose.stone.y, pose.stone.rx * pose.stone.k] });
  return out;
}

describe("peacock's tail", () => {
  const size = Math.max(peacocksTail.size.w, peacocksTail.size.h);

  it('grows continuously: no fan, band or stone jumps, appears large or vanishes large', () => {
    for (const seed of [1, 4, 9]) {
      const p = plan(seed);
      let prev = marks(posePeacocksTail(p, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(posePeacocksTail(p, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(size * 0.02);
            continue;
          }
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(size * 0.04);
        }
        for (const [id, m] of prev) if (!cur.has(id)) expect(m.size, `${id} vanished at g=${g}`).toBeLessThan(size * 0.02);
        prev = cur;
      }
    }
  }, 60_000);

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = peacocksTail.size;
    const left = -w * peacocksTail.anchor.x;
    const top = -h * peacocksTail.anchor.y;
    for (let seed = 1; seed <= 30; seed++) {
      const pts = peacocksTailReach(plan(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h - 1);
    }
  });

  it('is a cluster of five overlapping fans with concentric bands, alternating chalk and olive', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const p = plan(seed);
      const pose = posePeacocksTail(p, 1);
      expect(pose.fans.length, `seed ${seed}`).toBe(5);
      for (const f of pose.fans) {
        expect(f.rings.length, `seed ${seed} ${f.id}`).toBeGreaterThanOrEqual(8);
        expect(f.rings.some((r) => r.chalk) && f.rings.some((r) => !r.chalk)).toBe(true);
      }
      const widths = pose.fans.map((f) => Math.max(...f.rim.map((q) => q.x)) - Math.min(...f.rim.map((q) => q.x)));
      expect(Math.min(...widths), `seed ${seed}`).toBeLessThan(Math.max(...widths) * 0.7);
    }
  });

  it('grows one small fan on a stone, then a few fans, then the full cluster', () => {
    const p = plan(2);
    const n = (g: number) => posePeacocksTail(p, g).fans.length;
    expect(n(0.1)).toBe(1);
    expect(n(0.3)).toBeGreaterThanOrEqual(2);
    expect(n(0.3)).toBeLessThan(5);
    expect(n(1)).toBe(5);
    const height = (g: number) => -Math.min(...posePeacocksTail(p, g).fans.flatMap((f) => f.rim.map((q) => q.y)));
    expect(height(0.1)).toBeLessThan(height(1) * 0.3);
    expect(posePeacocksTail(p, 0.1).stone).not.toBeNull();
  });

  it('is a tier-1 small water alga under the surface: no rim light, not visited by bees', () => {
    expect(peacocksTail.tier).toBe(1);
    expect(peacocksTail.sizeClass).toBe('small');
    expect(peacocksTail.habitats).toEqual(['water']);
    expect(peacocksTail.rimLight).toBe(false);
    expect(peacocksTail.pollinators).toBe(false);
    expect(peacocksTail.description.length).toBeLessThan(80);
  });

  it('is offered by the coast only, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(peacocksTail.range).toEqual({ realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] });
    expect(growsIn('peacocks-tail', peacocksTail.range, getScenery('coast').flora)).toBe(true);
    for (const id of ['japanese-garden', 'waterfall', 'oasis'] as const) expect(growsIn('peacocks-tail', peacocksTail.range, getScenery(id).flora), id).toBe(false);
  });

  it("fits every water slot of the coast, the two small rock pools included", () => {
    const ids = compatibleSlots(peacocksTail, getScenery('coast').geometry.slots, []).map((o) => o.slot.id);
    expect(ids.sort()).toEqual(['pool-1', 'pool-2', 'pool-3', 'shallows-1', 'shallows-2', 'shallows-3', 'shallows-4', 'shallows-5', 'shallows-6']);
  });
});
