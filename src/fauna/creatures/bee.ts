/**
 * Bees: small visitors working the pollinator flowers. They zip in, hover in front of a flower,
 * settle and crawl on it, make short hops to the next bloom nearby, and leave. Side view.
 */
import { blob, lighten, mix, PIGMENTS } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { approach, dist, isOffscreen, rangeOf, springStep } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import type { FlowerTarget } from '../targets';
import { FAUNA_TUNING, SIZES, SPEEDS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { entryPoint, exitPoint, nextFlower } from './flight';

export interface BeeParts {
  body: Sprite;
  wings: Sprite;
  blur: Sprite;
}

export function paintBee(res: number, seed: number): BeeParts {
  const L = SIZES.bee;
  const box = { w: L * 1.7, h: L * 1.5, ox: L * 0.8, oy: L * 0.85 };
  const body = paintSprite(res, box, seed, (p, rng) => {
    const gold = mix(PIGMENTS.gold, '#c99a4a', 0.4);
    const dark = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.25);
    // abdomen (rear, slightly drooping) and fuzzy thorax merge wet-in-wet; facing +x
    const L1 = p.layer({ x: -L * 0.8, y: -L * 0.5, w: L * 1.4, h: L });
    p.dabInto(L1, { x: -L * 0.02, y: L * 0.02 }, gold, { rng, variant: 'round', angle: Math.PI + 0.15, length: L * 0.6, width: L * 0.44 });
    p.dabInto(L1, { x: L * 0.27, y: -L * 0.02 }, mix(dark, gold, 0.45), { rng, variant: 'round', angle: Math.PI, length: L * 0.32, width: L * 0.34 });
    L1.dry({ opacity: 0.9, edge: 0.35, edgeWidth: 0.5, flow: 0.5, flowScale: 3 });
    const S = p.layer({ x: -L * 0.8, y: -L * 0.5, w: L * 1.4, h: L });
    S.clip(blob(-L * 0.32, L * 0.05, L * 0.25, L * 0.16, rng, { rotation: 0.15, irregularity: 0.04 }));
    for (let k = 0; k < 3; k++) {
      const x = -L * (0.2 + k * 0.13);
      S.fill(blob(x, L * 0.05, L * 0.035, L * 0.3, rng, { rotation: 0.2 }), dark, 0.7);
    }
    S.dry({ opacity: 0.6, edge: 0.3, edgeWidth: 0.4 });
    p.dab({ x: L * 0.31, y: -L * 0.03 }, dark, { rng, variant: 'round', angle: 0, length: L * 0.2, width: L * 0.22, opacity: 0.85 });
    p.inkLine([{ x: L * 0.48, y: -L * 0.1 }, { x: L * 0.6, y: -L * 0.3 }], { rng, width: 0.12, opacity: 0.5, breaks: 0 });
    for (let k = 0; k < 2; k++) p.inkLine([{ x: L * (0.18 + k * 0.1), y: L * 0.13 }, { x: L * (0.14 + k * 0.12), y: L * 0.3 }], { rng, width: 0.1, opacity: 0.4, breaks: 0 });
  });
  const glass = lighten(PIGMENTS.celadon, 0.45);
  const wing = (alpha: number, passes: number, s: number) =>
    paintSprite(res, box, seed + s, (p, rng) => {
      for (let k = 0; k < passes; k++) {
        const a = -Math.PI / 2 - 0.75 + (passes === 1 ? 0 : (k / (passes - 1) - 0.5) * 1.6);
        p.dab({ x: L * 0.22, y: -L * 0.16 }, glass, { rng, variant: 'petal', angle: a, length: L * 0.6, width: L * 0.24, opacity: alpha, edge: 0.35, blend: 'source-over' });
        p.dab({ x: L * 0.16, y: -L * 0.14 }, glass, { rng, variant: 'petal', angle: a - 0.35, length: L * 0.42, width: L * 0.18, opacity: alpha * 0.9, edge: 0.35, blend: 'source-over' });
      }
    });
  return { body, wings: wing(0.4, 1, 1), blur: wing(0.1, 6, 2) };
}

export class Bee extends BaseCreature {
  readonly kind = 'bee' as const;
  readonly visitor = true;
  override layer: LayerId = 'air';
  private pos: Pt;
  private vel: Pt = { x: 0, y: 0 };
  private target: Pt;
  private flower: FlowerTarget | null = null;
  private visits: number;
  private readonly stay: number;
  private until = 0;
  private buzz = 0;
  private facing = 1;
  private readonly cruise: number;

  constructor(w: FaunaWorld, stay: number, delay = 0) {
    super();
    const rng = w.rng;
    this.stay = stay;
    this.visits = rng.int(4, 9);
    this.cruise = rangeOf(rng, SPEEDS.bee);
    this.pos = entryPoint(w.view, rng, 0.4, 0.8);
    this.target = this.pickFlower(w);
    this.until = delay;
    this.state = delay > 0 ? 'wait' : 'fly';
    this.sync();
  }

  private pickFlower(w: FaunaWorld): Pt {
    this.flower = nextFlower(w.flowers, this.pos, w.rng, this.flower?.plantId ?? null, 120);
    if (!this.flower) {
      const v = w.view;
      return { x: v.x + v.w * w.rng.range(0.2, 0.8), y: v.y + v.h * w.rng.range(0.6, 0.85) };
    }
    // a point among the heads, not always the same one
    return { x: this.flower.x + w.rng.range(-0.6, 0.6) * this.flower.r, y: this.flower.y + w.rng.range(-0.4, 0.4) * this.flower.r };
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    const sf = w.speed;
    this.buzz += dt * 40;
    if (!this.leaving && this.timer > this.stay && this.state !== 'wait') this.leaving = true;
    if (this.leaving && this.state !== 'leave' && this.state !== 'wait') {
      this.target = exitPoint(w.view, this.pos, w.rng, 100);
      this.go('leave');
    }
    switch (this.state) {
      case 'wait':
        if (this.timer >= this.until) this.go('fly');
        break;
      case 'fly':
      case 'leave': {
        const d = dist(this.pos, this.target);
        const toward = Math.atan2(this.target.y - this.pos.y, this.target.x - this.pos.x);
        const weave = Math.sin(this.timer * 5 + this.id) * 0.35;
        const sp = this.cruise * sf * Math.min(1, 0.3 + d / 60);
        this.vel.x = approach(this.vel.x, Math.cos(toward + weave) * sp, 5, dt);
        this.vel.y = approach(this.vel.y, Math.sin(toward + weave) * sp, 5, dt);
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        if (this.state === 'leave') {
          if (isOffscreen(this.pos, w.view, FAUNA_TUNING.offscreen)) this.done = true;
        } else if (d < 9) {
          this.go(this.flower ? 'hover' : 'fly');
          this.until = w.rng.range(0.5, 1.6);
          if (!this.flower) {
            this.visits--;
            this.target = this.pickFlower(w);
          }
        }
        break;
      }
      case 'hover': {
        // hanging in front of the bloom: tiny quick corrections
        const j = { x: this.target.x - this.facing * 5 + w.noise(this.timer * 3, this.id) * 1.6, y: this.target.y - 3 + w.noise(this.id, this.timer * 3.4) * 1.4 };
        springStep(this.pos, this.vel, j, 9 * sf, dt);
        if (this.timer > this.until) {
          this.go('land');
          this.until = w.rng.range(1.2, 3.8) / sf;
        }
        break;
      }
      case 'land': {
        // settled on the flower, crawling a little
        const c = { x: this.target.x + Math.sin(this.timer * 0.9 + this.id) * 1.2, y: this.target.y + Math.cos(this.timer * 0.7) * 0.6 };
        springStep(this.pos, this.vel, c, 6, dt);
        if (this.timer > this.until) {
          this.visits--;
          if (this.visits <= 0) this.leaving = true;
          else {
            this.target = this.pickFlower(w);
            this.go('fly');
          }
        }
        break;
      }
    }
    if (Math.abs(this.vel.x) > 6) this.facing = Math.sign(this.vel.x);
    this.sync();
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'air' || this.state === 'wait') return;
    const variant = this.id % 3;
    const parts = w.art.get(`bee:${variant}`, (res) => paintBee(res, 600 + variant * 3));
    const ps = w.perspective(this.y + 30);
    const flying = this.state !== 'land';
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps * this.facing, ps);
    if (flying) ctx.rotate(Math.max(-0.4, Math.min(0.4, this.vel.y * 0.01 * this.facing)));
    const b = parts.body;
    ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    const wing = flying || Math.sin(this.timer * 2) > 0.95 ? parts.blur : parts.wings;
    ctx.globalAlpha = flying ? 0.75 + 0.25 * Math.sin(this.buzz) : 1;
    ctx.drawImage(wing.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    ctx.restore();
  }
}
