/**
 * Frog: sits on a lily / lotus pad (only when one grows in the pond), throat pulsing as it
 * breathes; once in a long while it hops into the water with a ring, stays under a while, and
 * climbs back onto its pad. Painted three-quarter side view facing right.
 */
import { blob, lighten, mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, easeInOut, insideWithMargin, lerp, rangeOf, toPlane, toWorld } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import type { Pad } from '../targets';
import { FAUNA_TUNING, SIZES } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';

export interface FrogParts {
  sit: Sprite;
  leap: Sprite;
  throat: Sprite;
}

const SKIN = mix(PIGMENTS.sap, PIGMENTS.sage, 0.35);

function paintSit(p: Painter, L: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * L, y: y * L });
  // body hunched, head forward-right, feet at y = 0
  const body = smoothPolygon([P(0.48, -0.36), P(0.34, -0.5), P(0.05, -0.52), P(-0.3, -0.38), P(-0.46, -0.12), P(-0.38, 0), P(0.2, 0), P(0.46, -0.08), P(0.55, -0.22)], 2);
  p.wetInWet(body, SKIN, mix(PIGMENTS.petalWhite, PIGMENTS.gold, 0.25), { rng, angle: Math.PI / 2 + 0.2, split: 0.72, softness: 0.3, opacity: 0.92, edge: 0.5, edgeWidth: 0.7, deform: 0.06, spread: 0.05, blend: 'source-over' });
  // spots on the back
  const M = p.layer({ x: -L * 0.6, y: -L * 0.7, w: L * 1.3, h: L * 0.8 });
  M.clip(body);
  for (let i = 0; i < 5; i++) M.fill(blob(rng.range(-0.3, 0.25) * L, rng.range(-0.46, -0.28) * L, L * rng.range(0.03, 0.06), L * rng.range(0.025, 0.04), rng), PIGMENTS.olive, 0.5);
  M.dry({ opacity: 0.6, edge: 0.4, edgeWidth: 0.5 });
  // folded hind leg (big thigh), front leg
  p.dab(P(-0.1, -0.06), mix(SKIN, PIGMENTS.olive, 0.25), { rng, variant: 'leaf', angle: Math.PI + 0.25, length: L * 0.42, width: L * 0.2, opacity: 0.85 });
  p.dab(P(-0.42, -0.02), mix(SKIN, PIGMENTS.olive, 0.3), { rng, variant: 'leaf', angle: 0.05, length: L * 0.36, width: L * 0.08, opacity: 0.8 });
  p.dab(P(0.32, -0.02), mix(SKIN, PIGMENTS.olive, 0.25), { rng, variant: 'blade', angle: -Math.PI / 2 - 0.25, length: L * 0.18, width: L * 0.06, opacity: 0.8 });
  // eye bump with a dark eye, mouth line
  p.dab(P(0.31, -0.4), lighten(SKIN, 0.1), { rng, variant: 'round', angle: -Math.PI / 2, length: L * 0.11, width: L * 0.12, opacity: 0.9 });
  p.dab(P(0.32, -0.46), PIGMENTS.sumi, { rng, variant: 'round', angle: 0, length: L * 0.06, width: L * 0.06, opacity: 0.9 });
  p.inkLine([P(0.52, -0.25), P(0.38, -0.3), P(0.22, -0.32)], { rng, width: 0.3, opacity: 0.45, breaks: 0 });
}

function paintLeap(p: Painter, L: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * L, y: y * L });
  const body = smoothPolygon([P(0.55, -0.12), P(0.4, -0.26), P(0, -0.24), P(-0.3, -0.12), P(-0.3, 0), P(0.1, 0.04), P(0.5, 0)], 2);
  p.wetInWet(body, SKIN, mix(PIGMENTS.petalWhite, PIGMENTS.gold, 0.25), { rng, angle: Math.PI / 2, split: 0.62, opacity: 0.92, edge: 0.5, edgeWidth: 0.7, deform: 0.06, spread: 0.05, blend: 'source-over' });
  for (const dy of [-0.06, 0.04]) p.dab(P(-0.26, dy), mix(SKIN, PIGMENTS.olive, 0.3), { rng, variant: 'blade', angle: Math.PI - 0.12 + dy, length: L * 0.62, width: L * 0.09, opacity: 0.85 });
  p.dab(P(0.4, 0.02), mix(SKIN, PIGMENTS.olive, 0.3), { rng, variant: 'blade', angle: 0.5, length: L * 0.2, width: L * 0.05, opacity: 0.8 });
  p.dab(P(0.38, -0.27), PIGMENTS.sumi, { rng, variant: 'round', angle: 0, length: L * 0.06, width: L * 0.06, opacity: 0.9 });
}

export function paintFrog(res: number, seed: number): FrogParts {
  const L = SIZES.frog;
  const box = { w: L * 1.3, h: L * 0.8, ox: L * 0.55, oy: L * 0.65 };
  return {
    sit: paintSprite(res, box, seed, (p) => paintSit(p, L)),
    leap: paintSprite(res, { w: L * 1.6, h: L * 0.6, ox: L * 0.95, oy: L * 0.35 }, seed + 1, (p) => paintLeap(p, L)),
    throat: paintSprite(res, { w: L * 0.3, h: L * 0.22, ox: L * 0.15, oy: L * 0.04 }, seed + 2, (p, rng) => {
      p.dab({ x: 0, y: 0 }, mix(PIGMENTS.petalWhite, PIGMENTS.gold, 0.3), { rng, variant: 'round', angle: Math.PI / 2, length: L * 0.16, width: L * 0.22, opacity: 0.85, blend: 'source-over' });
    }),
  };
}

export class Frog extends BaseCreature {
  readonly kind = 'frog' as const;
  readonly visitor = false;
  override layer: LayerId = 'entities';
  pad: Pad;
  private seat: Pt;
  private facing: number;
  private nextDive: number;
  private away = 0;
  private from: Pt = { x: 0, y: 0 };
  private to: Pt = { x: 0, y: 0 };
  private breath: number;

  constructor(w: FaunaWorld, pad: Pad) {
    super();
    const rng = w.rng;
    this.pad = pad;
    this.seat = { x: pad.x + rng.range(-0.35, 0.35) * pad.r, y: pad.y - 1.5 };
    this.facing = rng.chance(0.5) ? -1 : 1;
    this.nextDive = rangeOf(rng, FAUNA_TUNING.frogDive);
    this.breath = rng.range(0, 6);
    this.state = 'arrive';
    this.alpha = 0;
    this.x = this.seat.x;
    this.y = this.seat.y;
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    this.breath += dt * (w.mode.lively ? 1.15 : 1) * w.speed;
    switch (this.state) {
      case 'arrive':
      case 'return': {
        // climbing up onto the pad out of the water
        this.alpha = Math.min(1, this.alpha + dt * 0.7);
        const k = easeInOut(this.timer / 1.6);
        this.x = this.seat.x;
        this.y = this.seat.y + (1 - k) * 4;
        if (this.timer >= 1.6) this.go('sit');
        break;
      }
      case 'sit':
        this.x = this.seat.x;
        this.y = this.seat.y;
        if (w.rng.chance(dt / 70)) this.facing = -this.facing;
        if (this.leaving || this.timer > this.nextDive / w.speed) this.go('crouch');
        break;
      case 'crouch':
        if (this.timer > 0.45) this.jump(w);
        break;
      case 'leap': {
        const k = clamp(this.timer / 0.55, 0, 1);
        this.x = lerp(this.from.x, this.to.x, k);
        this.y = lerp(this.from.y, this.to.y, k) - Math.sin(k * Math.PI) * 12;
        if (k >= 1) {
          w.ripple(this.to.x, this.to.y, 30, 1);
          this.go('away');
          this.away = rangeOf(w.rng, FAUNA_TUNING.frogAway);
          if (this.leaving) this.done = true;
        }
        break;
      }
      case 'away':
        if (this.timer > this.away) {
          w.ripple(this.seat.x + this.facing * 6, this.seat.y + 2, 16, 0.6);
          this.nextDive = rangeOf(w.rng, FAUNA_TUNING.frogDive);
          this.alpha = 0;
          this.go('return');
        }
        break;
    }
  }

  private jump(w: FaunaWorld): void {
    // into open water a little way off, never onto land
    this.from = { x: this.x, y: this.y };
    const pond = w.pond;
    let to: Pt | null = null;
    for (let i = 0; i < 12 && !to; i++) {
      const dir = i < 6 ? this.facing : -this.facing;
      const q = { x: this.x + dir * w.rng.range(26, 46), y: this.y + w.rng.range(-6, 8) };
      if (insideWithMargin(toPlane(q, pond.cy, pond.squash), pond.plane, 12)) {
        to = q;
        this.facing = dir;
      }
    }
    this.to = to ?? toWorld(toPlane({ x: pond.centre.x, y: pond.cy }, pond.cy, pond.squash), pond.cy, pond.squash);
    this.facing = this.to.x >= this.x ? 1 : -1;
    this.go('leap');
  }

  override depth(): number | null {
    return this.state === 'away' ? null : this.pad.y + 0.6;
  }

  override leave(): void {
    this.leaving = true;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities' || this.state === 'away') return;
    const parts = w.art.get('frog', (res) => paintFrog(res, 1200));
    const ps = this.pad.scale;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(ps * this.facing, ps);
    if (this.state === 'leap') {
      const k = clamp(this.timer / 0.55, 0, 1);
      ctx.rotate(lerp(-0.5, 0.6, k));
      const s = parts.leap;
      ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
    } else {
      const squash = this.state === 'crouch' ? 1 - 0.12 * Math.sin(clamp(this.timer / 0.45, 0, 1) * Math.PI * 0.5) : 1;
      ctx.scale(1, squash);
      const s = parts.sit;
      ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
      // the throat pulses with each breath
      const b = 0.5 + 0.5 * Math.sin(this.breath * Math.PI * 2 * 0.75);
      const t = parts.throat;
      const L = SIZES.frog;
      ctx.translate(L * 0.4, -L * 0.2);
      ctx.scale(0.75 + 0.45 * b * b, 0.7 + 0.5 * b * b);
      ctx.globalAlpha = this.alpha * (0.6 + 0.4 * b);
      ctx.drawImage(t.img as CanvasImageSource, -t.ox, -t.oy, t.w, t.h);
    }
    ctx.restore();
  }
}
