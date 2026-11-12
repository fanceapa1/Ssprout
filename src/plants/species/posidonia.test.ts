import { describe, expect, it } from 'vitest';
import { compatibleSlots } from '../../core/placement';
import { createRng } from '../../core/rng';
import { getScenery } from '../../scenery/registry';
import { growsIn } from '../flora';
import { shrubSuite } from '../lib/suites';
import { recordingPainter } from '../lib/small-recorder';
import posidonia, { planPosidonia, posePosidonia, posidoniaReach, type PosidoniaPose } from './posidonia';

shrubSuite('posidonia', planPosidonia, { habitats: ['water'], sizeClass: 'large' });

const plan = (seed: number) => planPosidonia(createRng(seed).fork('posidonia'));

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: PosidoniaPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const l of pose.leaves) {
    const tip = l.pts[l.pts.length - 1]!;
    const mid = l.pts[Math.floor(l.pts.length / 2)]!;
    const len = Math.hypot(tip.x - l.pts[0]!.x, tip.y - l.pts[0]!.y);
    out.set(l.id, { size: Math.max(len, ...l.widths), pts: [l.pts[0]!.x, l.pts[0]!.y, mid.x, mid.y, tip.x, tip.y, Math.max(...l.widths), l.brown * 10] });
  }
  for (const d of pose.dead) out.set(d.id, { size: Math.hypot(d.pts[6]!.x - d.pts[0]!.x, d.pts[6]!.y - d.pts[0]!.y), pts: [d.pts[6]!.x, d.pts[6]!.y, d.width] });
  for (const b of pose.balls) out.set(b.id, { size: b.r * 2 * b.k, pts: [b.at.x, b.at.y, b.r * b.k] });
  for (const b of pose.bubbles) out.set(b.id, { size: b.r * 2 * b.k, pts: [b.r * b.k] });
  if (pose.bloom) out.set('bloom', { size: 9 * pose.bloom.k, pts: [pose.bloom.at.x, pose.bloom.at.y, 9 * pose.bloom.k] });
  return out;
}

describe('posidonia', () => {
  const size = Math.max(posidonia.size.w, posidonia.size.h);

  it('draws the same marks for the same seed and growth, and other marks for another seed', () => {
    const rec = (seed: number, g: number) => {
      const { painter, calls } = recordingPainter(posidonia.size.w * 2, posidonia.size.h * 2);
      posidonia.draw(painter, createRng(seed).fork('posidonia'), { w: posidonia.size.w * 2, h: posidonia.size.h * 2, growth: g });
      return calls;
    };
    for (const g of [0, 0.3, 1]) expect(rec(7, g)).toEqual(rec(7, g));
    expect(rec(1, 1)).not.toEqual(rec(2, 1));
  });

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 4, 9]) {
      const p = plan(seed);
      let prev = marks(posePosidonia(p, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(posePosidonia(p, g));
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
    const { w, h } = posidonia.size;
    const left = -w * posidonia.anchor.x;
    const top = -h * posidonia.anchor.y;
    for (let seed = 1; seed <= 30; seed++) {
      const pts = posidoniaReach(plan(seed));
      expect(Math.min(...pts.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(left + 2);
      expect(Math.max(...pts.map((q) => q.x)), `seed ${seed}`).toBeLessThan(left + w - 2);
      expect(Math.min(...pts.map((q) => q.y)), `seed ${seed}`).toBeGreaterThan(top + 2);
      expect(Math.max(...pts.map((q) => q.y)), `seed ${seed}`).toBeLessThan(top + h - 1);
    }
  });

  it('is a dense meadow of long ribbons all leaning with the swell, old tips browned, a few at the surface', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = posePosidonia(plan(seed), 1);
      expect(pose.leaves.length, `seed ${seed}`).toBeGreaterThan(100);
      const lean = pose.leaves.filter((l) => l.pts[l.pts.length - 1]!.x > l.pts[0]!.x).length / pose.leaves.length;
      expect(lean, `seed ${seed}`).toBeGreaterThan(0.85);
      const brown = pose.leaves.filter((l) => l.brown > 0.1).length / pose.leaves.length;
      expect(brown, `seed ${seed}`).toBeGreaterThan(0.2);
      expect(brown, `seed ${seed}`).toBeLessThan(0.7);
      const surface = pose.leaves.filter((l) => l.surfaceFrom < l.pts.length - 1).length;
      expect(surface, `seed ${seed}`).toBeGreaterThan(0);
      expect(surface, `seed ${seed}`).toBeLessThan(pose.leaves.length * 0.4);
      expect(pose.balls.length + pose.dead.length, `seed ${seed}`).toBeGreaterThan(2);
    }
  });

  it('grows a few short shoots on bare sand, then a spreading tuft, then the full meadow', () => {
    const p = plan(2);
    const reach = (pose: PosidoniaPose) => Math.max(...pose.leaves.map((l) => Math.abs(l.pts[0]!.x + 8)));
    const shoots = (pose: PosidoniaPose) => new Set(pose.leaves.map((l) => l.id.split('l')[0])).size;
    const young = posePosidonia(p, 0.15);
    const tuft = posePosidonia(p, 0.5);
    const full = posePosidonia(p, 1);
    expect(shoots(young)).toBeGreaterThan(0);
    expect(shoots(young)).toBeLessThan(8);
    expect(reach(young)).toBeLessThan(reach(full) * 0.6);
    expect(shoots(tuft)).toBeLessThan(shoots(full));
    expect(shoots(tuft)).toBeGreaterThan(shoots(young));
    expect(young.leaves.every((l) => l.surfaceFrom >= l.pts.length - 1)).toBe(true);
    expect(young.balls.length + young.dead.length).toBe(0);
  });

  it('flowers or fruits only now and then, and only at full growth', () => {
    const kinds = Array.from({ length: 60 }, (_, s) => plan(s + 1).bloom.kind);
    expect(kinds.filter((k) => k === 'flower').length).toBeGreaterThan(5);
    expect(kinds.filter((k) => k === 'fruit').length).toBeGreaterThan(5);
    expect(kinds.filter((k) => k === null).length).toBeGreaterThan(20);
    for (let s = 1; s <= 20; s++) expect(posePosidonia(plan(s), 0.85).bloom).toBeNull();
  });

  it('is a tier-3 large water plant under the surface: no rim light, not visited by bees', () => {
    expect(posidonia.tier).toBe(3);
    expect(posidonia.sizeClass).toBe('large');
    expect(posidonia.habitats).toEqual(['water']);
    expect(posidonia.rimLight).toBe(false);
    expect(posidonia.pollinators).toBe(false);
    expect(posidonia.bloomColor).toBe('#6fae8a');
    expect(posidonia.description.length).toBeLessThan(80);
  });

  it('is offered by the coast only, not by the Japanese garden, the waterfall or the oasis', () => {
    expect(posidonia.range).toEqual({ realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] });
    expect(growsIn('posidonia', posidonia.range, getScenery('coast').flora)).toBe(true);
    for (const id of ['japanese-garden', 'waterfall', 'oasis'] as const) expect(growsIn('posidonia', posidonia.range, getScenery(id).flora), id).toBe(false);
  });

  it('fits the coast\'s one large shallows slot', () => {
    expect(compatibleSlots(posidonia, getScenery('coast').geometry.slots, []).map((o) => o.slot.id)).toEqual(['shallows-1']);
  });
});
