import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { compatibleSlots } from '../../core/placement';
import { floraOf } from '../flora';
import { getScenery } from '../../scenery/registry';
import { smallSuite } from '../lib/suites';
import { allSpecies, getSpecies } from '../registry';
import { frondPose, planSouthernMaidenhair } from './southern-maidenhair';

smallSuite('southern-maidenhair');

const plan = (seed: number) => planSouthernMaidenhair(createRng(seed).fork('plan'));

describe('southern maidenhair plan', () => {
  it('has seven to nine fronds, and at full growth at least two hang below the root', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = plan(seed);
      expect(p.fronds.length).toBeGreaterThanOrEqual(7);
      expect(p.fronds.length).toBeLessThanOrEqual(9);
      const hanging = p.fronds.filter((f) => frondPose(f, 1)!.leaflets.some((l) => l.at.y > 4)).length;
      expect(hanging, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps every stalk and leaflet inside the design box as it grows', () => {
    // the 70-unit design box with the root at (0.5, 0.6): x ±35, y −42 … 28
    for (let seed = 1; seed <= 40; seed++) {
      for (const f of plan(seed).fronds) {
        for (const e of [0.3, 0.6, 0.8, 1]) {
          const pose = frondPose(f, e, 1)!;
          for (const q of pose.stipe) {
            expect(Math.abs(q.x), `seed ${seed}`).toBeLessThan(34);
            expect(q.y, `seed ${seed}`).toBeGreaterThan(-41);
            expect(q.y, `seed ${seed}`).toBeLessThan(27);
          }
          for (const l of pose.leaflets) {
            expect(Math.abs(l.at.x) + l.size, `seed ${seed}`).toBeLessThan(35);
            expect(l.at.y - l.size, `seed ${seed}`).toBeGreaterThan(-42);
            expect(l.at.y + l.size, `seed ${seed}`).toBeLessThan(28);
          }
        }
      }
    }
  });

  it('unrolls continuously: leaflets only appear tiny and never jump', () => {
    for (const seed of [2, 7]) {
      for (const f of plan(seed).fronds) {
        let prev = new Map((frondPose(f, 0.001)?.leaflets ?? []).map((l) => [l.key, l]));
        for (let i = 1; i <= 200; i++) {
          const cur = new Map((frondPose(f, i / 200, 1)?.leaflets ?? []).map((l) => [l.key, l]));
          // leaflets only ever unfold: none vanishes once open
          for (const key of prev.keys()) expect(cur.has(key), `seed ${seed} at ${i}: ${key}`).toBe(true);
          for (const [key, l] of cur) {
            const b = prev.get(key);
            if (!b) {
              expect(l.size, `seed ${seed} at ${i}: ${key}`).toBeLessThan(0.6);
              continue;
            }
            expect(Math.hypot(l.at.x - b.at.x, l.at.y - b.at.y), `seed ${seed} at ${i}`).toBeLessThan(2.5);
            expect(Math.abs(l.size - b.size)).toBeLessThan(0.4);
          }
          prev = cur;
        }
      }
    }
  });

  it('only the grown fronds carry sori, on their rolled margins', () => {
    const p = plan(3);
    const young = p.fronds.map((f) => frondPose(f, 1, 0)!).flatMap((x) => x.leaflets);
    expect(young.every((l) => l.sori === 0)).toBe(true);
    const ripe = p.fronds.map((f) => frondPose(f, 1, 1)!).flatMap((x) => x.leaflets);
    expect(ripe.some((l) => l.sori > 0.9)).toBe(true);
  });
});

describe('southern maidenhair in the gardens', () => {
  it('is offered by the oasis only: the Japanese gardens keep their own maidenhair', () => {
    const offers = (s: 'oasis' | 'japanese-garden' | 'waterfall') => floraOf(allSpecies(), getScenery(s).flora).some((sp) => sp.id === 'southern-maidenhair');
    expect([offers('oasis'), offers('japanese-garden'), offers('waterfall')]).toEqual([true, false, false]);
  });

  it("fits the oasis's wet wall copings, the basin's near rim and the seguia's banks", () => {
    const def = getSpecies('southern-maidenhair')!;
    const ids = compatibleSlots(def, getScenery('oasis').geometry.slots, []).map((o) => o.slot.id);
    expect(ids).toEqual(expect.arrayContaining(['wall-2', 'wall-3', 'wall-4', 'rim-2', 'rim-3', 'seguia-1']));
  });
});
