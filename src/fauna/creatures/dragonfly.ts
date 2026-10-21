/**
 * Dragonfly: an occasional visitor over the water. It darts in from off-screen, holds still in
 * the air (wings a soft blur), darts again a short way, sometimes dips to touch the surface, and
 * leaves the way it came. Seen from above: long slender abdomen, four glassy wings.
 */
import { lighten, mix, PIGMENTS, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { approach, clamp, dist, isOffscreen, offscreenPoint, pointInPolygon, springStep, turnToward } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { FAUNA_TUNING, SIZES } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';

const BODIES: Pigment[] = [
  mix(PIGMENTS.bellflower, PIGMENTS.stone, 0.45), // shiokara-tombo, blue-grey
  mix(PIGMENTS.vermilion, PIGMENTS.wood, 0.3), // aka-tombo, red
  mix(PIGMENTS.gold, PIGMENTS.olive, 0.4), // ochre
];

export interface DragonflyParts {
  body: Sprite;
  wings: Sprite;
  blur: Sprite;
}

const WING_ANGLES = [1.42, 1.78]; // fore / hind, from the heading, per side

function paintWings(p: Painter, L: number, spreadJitter: number, alpha: number, passes: number): void {
  const rng = p.rng;
  const glass = lighten(PIGMENTS.celadon, 0.35);
  for (let k = 0; k < passes; k++) {
    const off = passes === 1 ? 0 : (k / (passes - 1) - 0.5) * spreadJitter;
    WING_ANGLES.forEach((base, i) => {
      for (const side of [-1, 1]) {
        const a = side * (base + off);
        const at = { x: i === 0 ? 0.6 : -1.4, y: 0 };
        const len = L * (i === 0 ? 0.47 : 0.44);
        p.dab(at, glass, { rng, variant: 'petal', angle: a, length: len, width: len * (i === 0 ? 0.19 : 0.23), opacity: alpha, pool: 0.1, basePool: 0.05, edge: 0.3, blend: 'source-over' });
        if (passes === 1) {
          const tip = { x: at.x + Math.cos(a) * len * 0.92, y: at.y + Math.sin(a) * len * 0.92 };
          p.inkLine([{ x: at.x + Math.cos(a) * 1.2, y: at.y + Math.sin(a) * 1.2 }, tip], { rng, width: 0.22, opacity: 0.32, breaks: 0.2 });
          p.dab({ x: at.x + Math.cos(a) * len * 0.84, y: at.y + Math.sin(a) * len * 0.84 }, PIGMENTS.sumi, { rng, variant: 'round', angle: a, length: 1.1, width: 0.55, opacity: 0.5 });
        }
      }
    });
  }
}

export function paintDragonfly(res: number, seed: number, variant: number): DragonflyParts {
  const L = SIZES.dragonfly;
  const box = { w: L * 1.3, h: L * 1.1, ox: L * 0.42, oy: L * 0.55 };
  const pig = BODIES[variant % BODIES.length]!;
  const body = paintSprite(res, box, seed, (p, rng) => {
    // abdomen: thin tapered stroke back from the thorax, a darker tip and faint segment ink
    const tail = [
      { x: -1, y: 0 },
      { x: -L * 0.32, y: rng.range(-0.4, 0.4) },
      { x: -L * 0.7, y: rng.range(-0.6, 0.6) },
    ];
    p.stroke(tail, { rng, pigment: pig, width: 1.25, taper: [0.02, 0.35], pressure: [1.25, 0.8, 0.75, 0.6], wobble: 0.1, wetness: 0.3, opacity: 0.9 });
    p.inkLine(tail, { rng, width: 0.35, opacity: 0.35, breaks: 0.35, taper: [0.1, 0.4] });
    for (let k = 1; k < 7; k++) {
      const x = -L * 0.09 * k;
      p.inkLine([{ x, y: -0.55 }, { x: x - 0.2, y: 0.55 }], { rng, width: 0.18, opacity: 0.22, breaks: 0 });
    }
    p.dab({ x: 1.2, y: 0 }, mix(pig, PIGMENTS.sumi, 0.35), { rng, variant: 'round', angle: Math.PI, length: L * 0.15, width: L * 0.085, opacity: 0.9 });
    for (const side of [-1, 1]) p.dab({ x: 0.9, y: side * 0.95 }, mix(PIGMENTS.sumi, pig, 0.3), { rng, variant: 'round', angle: 0, length: 2.1, width: 1.7, opacity: 0.85 });
  });
  const wings = paintSprite(res, box, seed + 1, (p) => paintWings(p, L, 0, 0.24, 1));
  const blur = paintSprite(res, box, seed + 2, (p) => paintWings(p, L, 0.55, 0.07, 6));
  return { body, wings, blur };
}

export class Dragonfly extends BaseCreature {
  readonly kind = 'dragonfly' as const;
  readonly visitor = true;
  override layer: LayerId = 'air';
  private pos: Pt;
  private vel: Pt = { x: 0, y: 0 };
  private target: Pt;
  private heading: number;
  private hoverFor = 0;
  private readonly variant: number;
  private readonly stay: number;
  private readonly side: number;
  private dipBase: Pt | null = null;
  private flutter = 0;
  private dipped = false;

  constructor(w: FaunaWorld, stay: number) {
    super();
    const rng = w.rng;
    this.variant = rng.int(0, BODIES.length - 1);
    this.stay = stay;
    this.side = rng.chance(0.5) ? -1 : 1;
    const b = w.pond.bounds;
    this.pos = offscreenPoint(w.view, this.side, b.y - rng.range(30, 120), FAUNA_TUNING.offscreen * 0.6);
    this.target = this.hoverPoint(w, true);
    this.heading = Math.atan2(this.target.y - this.pos.y, this.target.x - this.pos.x);
    this.state = 'dart';
    this.sync();
  }

  /** A point in the air over the water or just above the near bank. */
  private hoverPoint(w: FaunaWorld, far = false): Pt {
    const b = w.pond.bounds;
    const rng = w.rng;
    for (let i = 0; i < 10; i++) {
      const q = far
        ? { x: b.x + rng.range(0.15, 0.85) * b.w, y: b.y + rng.range(-0.9, 0.5) * b.h }
        : { x: this.pos.x + rng.range(-1, 1) * 110, y: this.pos.y + rng.range(-1, 1) * 45 };
      if (q.x > b.x - 40 && q.x < b.x + b.w + 40 && q.y > b.y - b.h * 1.1 && q.y < b.y + b.h * 0.75) return q;
    }
    return { x: b.x + b.w / 2, y: b.y };
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    const sf = w.speed;
    this.flutter += dt * 31;
    if (!this.leaving && this.timer > this.stay && this.state === 'hover') this.leaving = true;
    switch (this.state) {
      case 'dart': {
        springStep(this.pos, this.vel, this.target, (this.leaving ? 5 : 7.5) * sf, dt);
        const sp = Math.hypot(this.vel.x, this.vel.y);
        if (sp > 15) this.heading = turnToward(this.heading, Math.atan2(this.vel.y, this.vel.x), 9 * sf, dt);
        if (this.leaving && isOffscreen(this.pos, w.view, FAUNA_TUNING.offscreen * 0.3)) this.done = true;
        else if (dist(this.pos, this.target) < 2 && sp < 10) {
          this.go('hover');
          this.hoverFor = w.rng.range(1.5, 5) / sf;
          this.dipBase = null;
        }
        break;
      }
      case 'hover': {
        // held in the air: the faintest drift and bob; the body swings a little
        const n = w.noise(this.timer * 0.7, this.id * 7.3);
        const m = w.noise(this.id * 3.1, this.timer * 0.6);
        this.vel.x = approach(this.vel.x, 0, 8, dt);
        this.vel.y = approach(this.vel.y, 0, 8, dt);
        this.pos = { x: this.target.x + n * 1.6, y: this.target.y + m * 1.2 + Math.sin(this.timer * 2.1) * 0.6 };
        this.heading += w.noise(this.timer * 0.3, this.id) * 0.35 * dt;
        if (this.timer > this.hoverFor) {
          if (this.leaving) {
            this.target = offscreenPoint(w.view, this.pos.x < w.view.x + w.view.w / 2 ? -1 : 1, this.pos.y - w.rng.range(20, 80), FAUNA_TUNING.offscreen);
            this.go('dart');
          } else if (pointInPolygon({ x: this.pos.x, y: this.pos.y + 14 }, w.pond.world) && w.rng.chance(0.2)) {
            this.dipBase = { ...this.pos };
            this.dipped = false;
            this.go('dip');
          } else {
            this.target = this.hoverPoint(w, w.rng.chance(0.2));
            this.go('dart');
          }
        }
        break;
      }
      case 'dip': {
        // a quick touch of the tail on the water, and back up
        const base = this.dipBase ?? this.pos;
        const k = clamp(this.timer / 0.7, 0, 1);
        const down = Math.sin(k * Math.PI);
        this.pos = { x: base.x + k * 4, y: base.y + down * 14 };
        if (k >= 0.5 && !this.dipped) {
          w.ripple(this.pos.x, this.pos.y + 4, 12, 0.6);
          this.dipped = true;
        }
        if (k >= 1) {
          this.target = { ...this.pos };
          this.go('hover');
          this.hoverFor = w.rng.range(0.8, 2.5);
        }
        break;
      }
    }
    this.sync();
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'air') return;
    const parts = w.art.get(`dragonfly:${this.variant}`, (res) => paintDragonfly(res, 400 + this.variant, this.variant));
    const ps = w.perspective(this.y + 60);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps, ps * 0.72);
    ctx.rotate(this.heading);
    const flick = 0.7 + 0.3 * Math.sin(this.flutter);
    const wing = parts.blur;
    ctx.globalAlpha = flick;
    ctx.drawImage(wing.img as CanvasImageSource, -wing.ox, -wing.oy, wing.w, wing.h);
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.flutter * 0.5 + 1);
    ctx.drawImage(parts.wings.img as CanvasImageSource, -wing.ox, -wing.oy, wing.w, wing.h);
    ctx.globalAlpha = 1;
    const b = parts.body;
    ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    ctx.restore();
  }
}
