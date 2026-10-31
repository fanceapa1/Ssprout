/**
 * A drifting leaf: now and then one comes down from the trees, see-sawing as it falls, settles on
 * the pond with a small ring, drifts slowly on the surface and soaks away.
 */
import { lighten, mix, PIGMENTS, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { approach, clamp, containPoint, randomPointInside, rangeOf, TAU, toPlane, toWorld } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { SIZES, SPEEDS, VISITS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { variantOf, type CreatureDef } from './lib/def';

/** The tints' names, in `LEAF_PIGMENTS` order (`FaunaUnlock.variant`). */
export const LEAF_VARIANTS = ['katsura', 'maple', 'green'] as const;

const LEAF_PIGMENTS: Pigment[] = [
  mix(PIGMENTS.gold, PIGMENTS.sage, 0.45),
  mix(PIGMENTS.vermilion, PIGMENTS.wood, 0.55),
  lighten(PIGMENTS.sap, 0.05),
];

export function leafSprite(res: number, variant: number): Sprite {
  const s = SIZES.leaf;
  return paintSprite(res, { w: s * 1.5, h: s * 0.9, ox: s * 0.2, oy: s * 0.45 }, 700 + variant, (p, rng) => {
    const pig = LEAF_PIGMENTS[variant % LEAF_PIGMENTS.length]!;
    p.dab({ x: 0, y: 0 }, pig, { rng, variant: 'leaf', angle: 0, length: s * 1.15, width: s * 0.5, curve: rng.range(-0.12, 0.12), opacity: 0.85 });
    p.inkLine(
      [
        { x: -s * 0.18, y: 0.3 },
        { x: s * 0.5, y: rng.range(-0.4, 0.4) },
        { x: s * 1.02, y: 0 },
      ],
      { rng, width: 0.4, opacity: 0.45, breaks: 0.2, pigment: mix(PIGMENTS.sumi, pig, 0.4) },
    );
  });
}

export class Leaf extends BaseCreature {
  readonly kind = 'leaf' as const;
  readonly visitor = false;
  private readonly tint: number;
  private readonly land: Pt;
  private readonly x0: number;
  private readonly swing: number;
  private readonly omega: number;
  private readonly stay: number;
  /** plane position + drift while floating */
  private p: Pt = { x: 0, y: 0 };
  private v: Pt = { x: 0, y: 0 };
  private rot: number;
  private spin = 0;
  private flip = 1;

  constructor(w: FaunaWorld, stay: number, variants: readonly string[] = []) {
    super();
    const rng = w.rng;
    this.variant = variantOf(variants, LEAF_VARIANTS, rng, () => LEAF_VARIANTS[rng.int(0, LEAF_PIGMENTS.length - 1)]!);
    this.tint = LEAF_VARIANTS.indexOf(this.variant as (typeof LEAF_VARIANTS)[number]);
    const landPlane = randomPointInside(w.pond.plane, rng, 30);
    this.land = toWorld(landPlane, w.pond.cy, w.pond.squash);
    this.swing = rng.range(12, 22);
    this.omega = rng.range(1.2, 1.8);
    this.x0 = this.land.x + rng.range(-40, 40);
    this.x = this.x0;
    this.y = Math.max(w.view.y - 20, w.pond.bounds.y - rng.range(220, 300));
    this.rot = rng.range(0, TAU);
    this.stay = stay;
    this.layer = 'air';
    this.state = 'fall';
    this.alpha = 0;
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    const sf = w.speed;
    if (this.state === 'fall') {
      this.alpha = Math.min(1, this.alpha + dt * 0.8);
      this.spin += dt * this.omega * sf;
      this.y += SPEEDS.leafFall * sf * dt * (0.75 + 0.45 * Math.abs(Math.cos(this.spin)));
      const k = clamp((this.land.y - this.y) / 60, 0, 1); // settle the swing just before landing
      this.x = this.x0 + (this.land.x - this.x0) * (1 - k) + Math.sin(this.spin) * this.swing * k;
      this.flip = 0.35 + 0.65 * Math.abs(Math.cos(this.spin * 0.5));
      if (this.y >= this.land.y) {
        this.y = this.land.y;
        this.p = toPlane({ x: this.x, y: this.y }, w.pond.cy, w.pond.squash);
        const a = w.rng.range(0, TAU);
        const sp = rangeOf(w.rng, SPEEDS.leafDrift) * sf;
        this.v = { x: Math.cos(a) * sp, y: Math.sin(a) * sp };
        this.layer = 'waterSurface';
        this.go('float');
        w.ripple(this.x, this.y, 22, 0.7);
      }
      return;
    }
    // floating: a slow wandering drift, turning a little, kept off the shore
    const n = w.noise(this.timer * 0.05, this.id * 3.1);
    this.v.x = approach(this.v.x, this.v.x + n * 0.6, 1, dt);
    this.p = containPoint({ x: this.p.x + this.v.x * dt, y: this.p.y + this.v.y * dt }, w.pond.plane, 16);
    this.rot += dt * 0.05 * n * sf;
    this.flip = approach(this.flip, 1, 2, dt);
    const q = toWorld(this.p, w.pond.cy, w.pond.squash);
    this.x = q.x;
    this.y = q.y;
    if (this.state === 'float' && (this.timer > this.stay || this.leaving)) this.go('soak');
    if (this.state === 'soak') {
      this.alpha = Math.max(0, this.alpha - dt / 10);
      if (this.alpha <= 0) this.done = true;
    }
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== this.layer) return;
    const s = w.art.get(`leaf:${this.tint}`, (res) => leafSprite(res, this.tint));
    const ps = w.perspective(this.y, this.x);
    ctx.save();
    ctx.globalAlpha = this.alpha * (this.state === 'fall' ? 0.9 : 0.8);
    ctx.translate(this.x, this.y);
    if (this.state === 'fall') {
      ctx.scale(ps, ps);
      ctx.rotate(this.rot + Math.cos(this.spin) * 0.7);
      ctx.scale(1, this.flip);
    } else {
      ctx.scale(ps, ps * w.pond.squash * 1.3);
      ctx.rotate(this.rot);
    }
    ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  }
}

const leaf: CreatureDef = {
  kind: 'leaf',
  title: 'drifting leaf',
  role: 'drifter',
  visit: VISITS.leaf,
  variants: LEAF_VARIANTS,
  needs: (w) => w.pond.world.length >= 3,
  spawn: (w, s) => (w.pond.world.length < 3 ? [] : [new Leaf(w, s.stay, s.variants)]),
  sheet: {
    w: 360,
    h: 100,
    make(res) {
      return [0, 1, 2].map((v) => leafSprite(res, v));
    },
  },
  show: { order: 2, spec: { w: 360, h: 240 }, w: 540, h: 360 },
};
export default leaf;
