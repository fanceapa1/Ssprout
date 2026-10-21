/**
 * Studio sheets: the painted parts / frames of each creature, side by side.
 */
import type { Sprite } from '../sprite';
import type { FaunaKind } from '../tuning';
import { paintBee } from './bee';
import { paintBird } from './bird';
import { paintButterfly } from './butterfly';
import { paintDragonfly } from './dragonfly';
import { paintFrog } from './frog';
import { paintHeron } from './heron';
import { paintKoi } from './koi';
import { leafSprite } from './leaf';
import { striderSprites } from './strider';
import { paintSwallows } from './swallow';

export interface Sheet {
  make(res: number, seed: number): Sprite[];
  w: number;
  h: number;
}

export const SHEETS: Partial<Record<FaunaKind, Sheet>> = {
  frog: {
    w: 420,
    h: 120,
    make(res, seed) {
      const a = paintFrog(res, seed);
      return [a.sit, a.throat, a.leap];
    },
  },
  swallow: {
    w: 420,
    h: 130,
    make(res, seed) {
      const a = paintSwallows(res, seed);
      return [a.spread, a.up, a.swept];
    },
  },
  heron: {
    w: 720,
    h: 240,
    make(res, seed) {
      const a = paintHeron(res, seed);
      return [a.body, a.neck, a.flyBody, a.wing];
    },
  },
  bird: {
    w: 700,
    h: 200,
    make(res, seed) {
      const a = paintBird(res, seed, 'wagtail');
      const b = paintBird(res, seed + 5, 'sparrow');
      return [a.body, a.tail, a.legs, a.flyUp, a.flyDown, b.body, b.tail, b.flyUp, b.fold];
    },
  },
  butterfly: {
    w: 560,
    h: 140,
    make(res, seed) {
      const a = paintButterfly(res, seed, 'white');
      const b = paintButterfly(res, seed + 3, 'swallowtail');
      return [a.wingL, a.wingR, a.body, b.wingL, b.wingR, b.body];
    },
  },
  bee: {
    w: 360,
    h: 110,
    make(res, seed) {
      const a = paintBee(res, seed);
      return [a.body, a.wings, a.blur];
    },
  },
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
      return [a.body, a.tail, a.fin, a.bodyDeep, a.tailDeep, a.finDeep];
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
