import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../../core/rng';
import { getSpecies } from '../registry';
import { planJapaneseMaple } from '../species/japanese-maple';
import { planWeepingCherry } from '../species/weeping-cherry';

/** Every tier-4 tree builds its whole plan (skeleton, foliage, blossom) from the rng alone. */
const PLANS: Record<string, (rng: Rng) => unknown> = {
  'weeping-cherry': planWeepingCherry,
  'japanese-maple': planJapaneseMaple,
};

describe('tier-4 tree plans', () => {
  for (const [id, plan] of Object.entries(PLANS)) {
    describe(id, () => {
      it('is registered as a tier-4 species with a sane box', () => {
        const def = getSpecies(id)!;
        expect(def).toBeDefined();
        expect(def.tier).toBe(4);
        expect(def.size.w).toBeGreaterThan(200);
        expect(def.anchor.y).toBeGreaterThan(0.8);
      });

      it('is deterministic per seed', () => {
        expect(JSON.stringify(plan(createRng(42).fork(id)))).toEqual(JSON.stringify(plan(createRng(42).fork(id))));
      });

      it('varies with the seed', () => {
        expect(JSON.stringify(plan(createRng(1).fork(id)))).not.toEqual(JSON.stringify(plan(createRng(2).fork(id))));
      });

      it('does not depend on how much of the rng the caller already used', () => {
        const a = createRng(9).fork(id);
        const b = createRng(9).fork(id);
        b.next();
        b.next();
        expect(JSON.stringify(plan(a))).toEqual(JSON.stringify(plan(b)));
      });

      it('stays inside the sprite box', () => {
        const def = getSpecies(id)!;
        for (let s = 1; s <= 12; s++) {
          const p = plan(createRng(s).fork(id)) as { tree: { branches: { pts: { x: number; y: number }[] }[] } };
          for (const b of p.tree.branches)
            for (const q of b.pts) {
              expect(q.x).toBeGreaterThan(0);
              expect(q.x).toBeLessThan(def.size.w);
              expect(q.y).toBeGreaterThan(0);
              expect(q.y).toBeLessThan(def.size.h);
            }
        }
      });
    });
  }
});
