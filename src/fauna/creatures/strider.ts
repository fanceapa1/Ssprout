/**
 * Water striders: tiny residents of the pond surface. They rest with their legs splayed on the
 * film (four dimples), then row in a short burst and glide to a stop, leaving a faint ring.
 */
import { mix, PIGMENTS, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { angleDiff, approach, containPoint, insideWithMargin, randomPointInside, rangeOf, TAU, toWorld } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { FAUNA_TUNING, SIZES, SPEEDS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Legs as (angle from heading, length) pairs, per side, for a pose. */
const LEGS = {
  rest: [
    [0.5, 0.22],
    [1.45, 0.5],
    [2.45, 0.48],
  ],
  row: [
    [0.45, 0.22],
    [2.05, 0.52],
    [2.65, 0.46],
  ],
} as const;

function paintStrider(p: Painter, pose: keyof typeof LEGS, size: number): void {
  const rng = p.rng;
  const body = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.35);
  // dimples under the four long legs: a pale lifted dot with a darker lower rim
  for (const [a, l] of LEGS[pose].slice(1)) {
    for (const side of [-1, 1]) {
      const ang = side * a;
      const x = Math.cos(ang) * l * size;
      const y = Math.sin(ang) * l * size;
      p.dab({ x, y: y + 0.25 }, PIGMENTS.celadonDeep, { rng, variant: 'round', angle: 0, length: 1.2, width: 0.6, opacity: 0.28 });
      p.dab({ x, y: y - 0.15 }, PIGMENTS.petalWhite, { rng, variant: 'round', angle: 0, length: 0.9, width: 0.45, opacity: 0.6, blend: 'source-over' });
    }
  }
  for (const [a, l] of LEGS[pose]) {
    for (const side of [-1, 1]) {
      const ang = side * a;
      const knee = { x: Math.cos(ang * 0.8) * l * size * 0.45, y: Math.sin(ang * 0.8) * l * size * 0.45 };
      const tip = { x: Math.cos(ang) * l * size, y: Math.sin(ang) * l * size };
      p.inkLine([{ x: 0.6 * Math.cos(ang), y: 0.4 * Math.sin(ang) }, knee, tip], { rng, width: 0.2, pigment: body, opacity: 0.75, breaks: 0, taper: [0.05, 0.6] });
    }
  }
  p.dab({ x: -size * 0.16, y: 0 }, body, { rng, variant: 'leaf', angle: 0, length: size * 0.4, width: size * 0.075, opacity: 0.85 });
}

export function striderSprites(res: number, seed: number): { rest: Sprite; row: Sprite } {
  const s = SIZES.strider;
  const box = { w: s * 1.3, h: s * 1.2, ox: s * 0.65, oy: s * 0.6 };
  return {
    rest: paintSprite(res, box, seed, (p) => paintStrider(p, 'rest', s)),
    row: paintSprite(res, box, seed + 1, (p) => paintStrider(p, 'row', s)),
  };
}

export class Strider extends BaseCreature {
  readonly kind = 'strider' as const;
  readonly visitor = false;
  override layer: LayerId = 'waterSurface';
  /** plane position */
  p: Pt;
  heading: number;
  speed = 0;
  private rest: number;
  private readonly look: number;

  constructor(w: FaunaWorld) {
    super();
    this.p = randomPointInside(w.pond.plane, w.rng, FAUNA_TUNING.striderMargin * 2);
    this.heading = w.rng.range(0, TAU);
    this.rest = w.rng.range(1, 4);
    this.look = w.rng.int(0, 2);
    this.alpha = 0;
    this.state = 'rest';
    this.sync(w);
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    const plane = w.pond.plane;
    if (this.state === 'rest') {
      // tiny twitches while resting
      if (w.rng.chance(dt * 0.25)) this.heading += w.rng.range(-0.35, 0.35);
      if (this.timer >= this.rest && !this.leaving) this.burst(w);
    } else {
      this.speed = approach(this.speed, 0, 3.2, dt);
      this.p = { x: this.p.x + Math.cos(this.heading) * this.speed * dt, y: this.p.y + Math.sin(this.heading) * this.speed * dt };
      if (!insideWithMargin(this.p, plane, FAUNA_TUNING.striderMargin)) {
        this.p = containPoint(this.p, plane, FAUNA_TUNING.striderMargin);
        this.speed *= 0.4;
      }
      if (this.speed < 1.5) {
        this.speed = 0;
        this.go('rest');
        this.rest = w.rng.range(1.2, 6) / w.speed;
      }
    }
    this.alpha = this.leaving ? Math.max(0, this.alpha - dt * 0.4) : Math.min(1, this.alpha + dt * 0.5);
    if (this.leaving && this.alpha <= 0) this.done = true;
    this.sync(w);
  }

  private burst(w: FaunaWorld): void {
    const plane = w.pond.plane;
    // a new direction: mostly a modest turn, away from the edge and from other striders
    let best = this.heading;
    let bestScore = -Infinity;
    for (let i = 0; i < 6; i++) {
      const h = this.heading + w.rng.gaussian(0, 1.1);
      const probe = { x: this.p.x + Math.cos(h) * 30, y: this.p.y + Math.sin(h) * 30 };
      let score = insideWithMargin(probe, plane, FAUNA_TUNING.striderMargin * 1.5) ? 1 : -2;
      score -= Math.abs(angleDiff(this.heading, h)) * 0.2;
      for (const o of w.creatures) {
        if (o instanceof Strider && o !== this) {
          const d = Math.hypot(o.p.x - probe.x, o.p.y - probe.y);
          if (d < 40) score -= (40 - d) / 40;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }
    this.heading = best;
    this.speed = rangeOf(w.rng, SPEEDS.striderBurst) * w.speed;
    this.go('skate');
    if (this.alpha > 0.5) w.ripple(this.x, this.y, 9, 0.45);
  }

  private sync(w: FaunaWorld): void {
    const q = toWorld(this.p, w.pond.cy, w.pond.squash);
    this.x = q.x;
    this.y = q.y;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'waterSurface' || this.alpha <= 0.01) return;
    const sp = w.art.get(`strider:${this.look}`, (res) => striderSprites(res, 300 + this.look));
    const s = this.state === 'skate' && this.timer < 0.18 ? sp.row : sp.rest;
    const ps = w.perspective(this.y);
    ctx.save();
    ctx.globalAlpha = this.alpha * 0.9;
    ctx.translate(this.x, this.y);
    ctx.scale(ps, ps * w.pond.squash * 1.25);
    ctx.rotate(this.heading);
    ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  }

  override leave(): void {
    this.leaving = true;
  }
}

const strider: CreatureDef = {
  kind: 'strider',
  title: 'water striders',
  role: 'resident',
  rank: 1,
  resident: (n, mode) => (n > 0 ? (mode.reduced ? FAUNA_TUNING.reducedStriders : FAUNA_TUNING.striders) : 0),
  needs: (w) => w.pond.world.length >= 3,
  spawn(w, s) {
    if (w.pond.world.length < 3) return [];
    const out: Strider[] = [];
    for (let i = 0; i < s.count; i++) out.push(new Strider(w));
    return out;
  },
  sheet: {
    w: 360,
    h: 120,
    make(res, seed) {
      const a = striderSprites(res, seed);
      const b = striderSprites(res, seed + 7);
      return [a.rest, a.row, b.rest, b.row];
    },
  },
  show: { order: 1, spec: { w: 260, h: 160 }, w: 520, h: 320 },
};
export default strider;
