/**
 * Studio sheets: the painted parts / frames of each creature, side by side.
 */
import type { Sprite } from '../sprite';
import type { FaunaKind } from '../tuning';
import { paintDragonfly } from './dragonfly';
import { paintKoi } from './koi';
import { leafSprite } from './leaf';
import { striderSprites } from './strider';

export interface Sheet {
  make(res: number, seed: number): Sprite[];
  w: number;
  h: number;
}

export const SHEETS: Partial<Record<FaunaKind, Sheet>> = {
  dragonfly: {
    w: 520,
    h: 130,
    make(res, seed) {
      const a = paintDragonfly(res, seed, 0);
      const b = paintDragonfly(res, seed + 3, 1);
      return [a.body, a.wings, a.blur, b.body, b.wings];
    },
  },
  koi: {
    w: 620,
    h: 150,
    make(res, seed) {
      const a = paintKoi(res, seed, 'kohaku', 60);
      const b = paintKoi(res, seed + 1, 'yamabuki', 60);
      const c = paintKoi(res, seed + 2, 'sanke', 60);
      return [a.body, a.tail, a.fin, a.bodyDeep, b.body, b.tail, c.body, c.bodyDeep];
    },
  },
  strider: {
    w: 360,
    h: 120,
    make(res, seed) {
      const a = striderSprites(res, seed);
      const b = striderSprites(res, seed + 7);
      return [a.rest, a.row, b.rest, b.row];
    },
  },
  leaf: {
    w: 360,
    h: 100,
    make(res) {
      return [0, 1, 2].map((v) => leafSprite(res, v));
    },
  },
};
