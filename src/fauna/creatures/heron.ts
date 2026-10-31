/**
 * Grey heron: a rare visitor. It comes in high with slow, deep wingbeats, glides down to wade at
 * the pond's far edge, stands still for a long time with only the slowest neck movements (now and
 * then craning forward to watch the water), and leaves the same unhurried way. Its reflection
 * lies faintly on the water in front of it.
 */
import { mix, PIGMENTS, ribbon, smoothPath, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { approach, clamp, cubic, cubicLength, cubicTangent, easeInOut, isOffscreen, offscreenPoint, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import type { Stand } from '../targets';
import { FAUNA_TUNING, SIZES, SPEEDS, VISITS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

export interface HeronParts {
  body: Sprite; // standing body with legs, feet at the origin
  neck: Sprite; // neck and head, anchored at the neck base
  flyBody: Sprite; // body in flight (neck tucked, legs trailing), anchored at the body centre
  wing: Sprite; // one raised wing, anchored at the shoulder; flapping = vertical foreshortening
  /** shoulder relative to the flight body's centre */
  shoulder: Pt;
  /** neck base relative to the feet (world units at scale 1) */
  neckBase: Pt;
}

const GREY: Pigment = mix(PIGMENTS.stone, PIGMENTS.celadonMid, 0.25);
const DARK: Pigment = mix(PIGMENTS.sumi, PIGMENTS.stone, 0.35);
const PALE: Pigment = mix(PIGMENTS.petalWhite, PIGMENTS.stone, 0.12);
const BILL: Pigment = mix(PIGMENTS.gold, PIGMENTS.wood, 0.35);

function paintStanding(p: Painter, H: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * H, y: y * H });
  const leg = mix(BILL, PIGMENTS.stone, 0.45);
  // legs first (the body overlaps their tops)
  p.stroke([P(-0.03, -0.43), P(-0.025, -0.2), P(-0.035, 0)], { rng, pigment: leg, width: H * 0.012, taper: [0, 0.1], wobble: 0.1, opacity: 0.85 });
  p.stroke([P(0.02, -0.43), P(0.03, -0.2), P(0.045, -0.005)], { rng, pigment: leg, width: H * 0.011, taper: [0, 0.1], wobble: 0.1, opacity: 0.8 });
  for (const fx of [-0.035, 0.045]) p.inkLine([P(fx - 0.04, 0.004), P(fx + 0.05, 0)], { rng, width: H * 0.005, opacity: 0.5, pigment: leg });
  // body: long, tilted, tail drooping; darker back, paler breast
  const body = smoothPolygon(
    [P(0.12, -0.66), P(0.155, -0.6), P(0.13, -0.52), P(0.06, -0.45), P(-0.06, -0.42), P(-0.16, -0.4), P(-0.23, -0.405), P(-0.16, -0.47), P(-0.05, -0.56), P(0.05, -0.645)],
    2,
  );
  p.wetInWet(body, GREY, PALE, { rng, angle: Math.PI / 2 - 0.6, split: 0.58, softness: 0.4, opacity: 0.9, edge: 0.45, edgeWidth: 1, deform: 0.07, spread: 0.06, granulation: 0.25, granules: 0.3, blend: 'source-over' });
  // folded wing coverts and dark primaries along the back
  const M = p.layer({ x: -H * 0.3, y: -H * 0.7, w: H * 0.5, h: H * 0.35 });
  M.clip(body);
  M.fill(smoothPolygon([P(0.1, -0.64), P(-0.06, -0.56), P(-0.2, -0.44), P(-0.05, -0.47), P(0.08, -0.55)], 1), mix(GREY, DARK, 0.35), 0.55);
  M.fill(smoothPolygon([P(0.0, -0.56), P(-0.12, -0.49), P(-0.22, -0.42), P(-0.1, -0.45)], 1), DARK, 0.55);
  M.dry({ opacity: 0.7, edge: 0.4, edgeWidth: 0.8, flow: 0.5, flowScale: 10 });
  // drooping breast plumes, ink
  for (let k = 0; k < 4; k++) {
    const x = 0.12 - k * 0.012;
    p.inkLine([P(x, -0.55), P(x + 0.01, -0.5), P(x - 0.005, -0.45 + k * 0.006)], { rng, width: H * 0.004, opacity: 0.35, pigment: PIGMENTS.sumi });
  }
}

function neckPath(H: number, pose: 'stand' | 'tuck'): Pt[] {
  const P = (x: number, y: number) => ({ x: x * H, y: y * H });
  return pose === 'stand' ? [P(0, 0), P(0.035, -0.07), P(0.005, -0.15), P(0.03, -0.23), P(0.045, -0.27)] : [P(0, 0), P(0.05, -0.04), P(0.03, -0.09), P(0.08, -0.1)];
}

function paintNeck(p: Painter, H: number, pose: 'stand' | 'tuck'): void {
  const rng = p.rng;
  const path = smoothPath(neckPath(H, pose), H * 0.01);
  const neck = ribbon(path, (t) => H * (0.026 - 0.011 * t));
  p.wetInWet(neck, PALE, GREY, { rng, angle: Math.PI, split: 0.7, softness: 0.4, opacity: 0.92, edge: 0.45, edgeWidth: 0.8, deform: 0.05, spread: 0.04, blend: 'source-over' });
  // black streaks down the front of the neck
  const front = path.map((q, i) => ({ x: q.x + H * 0.014 - (i / path.length) * H * 0.006, y: q.y }));
  p.inkLine(front.slice(Math.floor(front.length * 0.15), Math.floor(front.length * 0.85)), { rng, width: H * 0.004, opacity: 0.45, breaks: 0.6 });
  const head = path[path.length - 1]!;
  p.wash({ cx: head.x + H * 0.008, cy: head.y, rx: H * 0.028, ry: H * 0.019, rotation: 0.1 }, PALE, { rng, opacity: 0.95, edge: 0.4, edgeWidth: 0.7, deform: 0.05, blend: 'source-over' });
  // dagger bill, black stripe through the eye to a trailing plume
  p.dab({ x: head.x + H * 0.03, y: head.y + H * 0.002 }, BILL, { rng, variant: 'leaf', angle: 0.1, length: H * 0.09, width: H * 0.016, opacity: 0.9 });
  p.inkLine([{ x: head.x + H * 0.022, y: head.y - H * 0.006 }, { x: head.x - H * 0.01, y: head.y - H * 0.012 }, { x: head.x - H * 0.07, y: head.y - H * 0.0 }], { rng, width: H * 0.007, opacity: 0.85, breaks: 0, taper: [0.1, 0.7] });
  p.dab({ x: head.x + H * 0.017, y: head.y - H * 0.004 }, PIGMENTS.sumi, { rng, variant: 'round', angle: 0, length: H * 0.008, width: H * 0.008, opacity: 0.9 });
}

function paintFlightBody(p: Painter, H: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * H, y: y * H });
  // legs trailing straight back
  p.stroke([P(-0.16, 0.012), P(-0.4, 0.03)], { rng, pigment: mix(BILL, PIGMENTS.stone, 0.45), width: H * 0.009, taper: [0, 0.25], wobble: 0.05, opacity: 0.8 });
  const body = smoothPolygon([P(0.13, -0.03), P(0.1, 0.03), P(-0.05, 0.045), P(-0.2, 0.025), P(-0.23, 0), P(-0.05, -0.04), P(0.09, -0.045)], 2);
  p.wetInWet(body, GREY, PALE, { rng, angle: Math.PI / 2, split: 0.55, opacity: 0.9, edge: 0.45, edgeWidth: 1, deform: 0.06, spread: 0.05, blend: 'source-over' });
  // retracted neck: an S pulled back into the shoulders, head forward
  p.ctx.save();
  p.ctx.translate(H * 0.1, -H * 0.03);
  paintNeck(p, H * 0.95, 'tuck');
  p.ctx.restore();
}

/** One wing, raised: root at the origin, reaching up and back to fingered primaries. */
function paintWing(p: Painter, H: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * H, y: y * H });
  const wing = smoothPolygon(
    [P(0.03, 0), P(0.06, -0.09), P(0.06, -0.19), P(0.02, -0.28), P(-0.05, -0.36), P(-0.1, -0.42), P(-0.12, -0.38), P(-0.15, -0.36), P(-0.16, -0.31), P(-0.19, -0.27), P(-0.2, -0.17), P(-0.17, -0.08), P(-0.1, 0.01)],
    1,
  );
  p.wash(wing, mix(GREY, PALE, 0.15), { rng, opacity: 0.9, edge: 0.5, edgeWidth: 1, deform: 0.05, spread: 0.04, granulation: 0.3, blend: 'source-over' });
  const L = p.layer({ x: -H * 0.3, y: -H * 0.48, w: H * 0.42, h: H * 0.52 });
  L.clip(wing);
  // dark flight feathers along the trailing edge and the tip, paler coverts at the root
  L.fill(smoothPolygon([P(0.04, -0.22), P(-0.1, -0.44), P(-0.22, -0.3), P(-0.22, -0.12), P(-0.15, -0.12), P(-0.1, -0.24)], 1), DARK, 0.6);
  L.dry({ opacity: 0.75, edge: 0.45, edgeWidth: 0.7, flow: 0.5, flowScale: 12 });
  for (let k = 0; k < 4; k++) {
    const y = -0.12 - k * 0.07;
    p.inkLine([P(-0.02 - k * 0.02, y), P(-0.14 - k * 0.012, y + 0.05)], { rng, width: H * 0.003, opacity: 0.25, breaks: 0.3 });
  }
}

export function paintHeron(res: number, seed: number): HeronParts {
  const H = SIZES.heron;
  const neckBase = { x: H * 0.11, y: -H * 0.6 };
  return {
    body: paintSprite(res, { w: H * 0.5, h: H * 0.68, ox: H * 0.32, oy: H * 0.66 }, seed, (p) => paintStanding(p, H)),
    neck: paintSprite(res, { w: H * 0.24, h: H * 0.34, ox: H * 0.1, oy: H * 0.31 }, seed + 1, (p) => paintNeck(p, H, 'stand')),
    flyBody: paintSprite(res, { w: H * 0.75, h: H * 0.3, ox: H * 0.48, oy: H * 0.17 }, seed + 2, (p) => paintFlightBody(p, H)),
    wing: paintSprite(res, { w: H * 0.32, h: H * 0.48, ox: H * 0.24, oy: H * 0.45 }, seed + 3, (p) => paintWing(p, H)),
    shoulder: { x: H * 0.02, y: -H * 0.03 },
    neckBase,
  };
}

interface Path {
  p: [Pt, Pt, Pt, Pt];
  len: number;
  u: number;
}

export class Heron extends BaseCreature {
  readonly kind = 'heron' as const;
  readonly visitor = true;
  readonly stand: Stand;
  private path: Path;
  private facing: number;
  private readonly stay: number;
  private wingT = 0;
  private neck = 0;
  private neckTarget = 0;
  private neckTimer = 4;
  private step: { from: number; to: number; t: number } | null = null;
  private heading = 0;

  constructor(w: FaunaWorld, stand: Stand, stay: number) {
    super();
    const rng = w.rng;
    this.stand = stand;
    this.stay = stay;
    const side = stand.x < w.view.x + w.view.w / 2 ? -1 : 1;
    const sky = w.scene.skyBand;
    const from = offscreenPoint(w.view, side, sky.bottom - rng.range(0, 60), FAUNA_TUNING.offscreen * 2.5);
    this.facing = -side;
    this.path = this.makePath(from, { x: stand.x, y: stand.y }, true);
    this.x = from.x;
    this.y = from.y;
    this.state = 'arrive';
  }

  private makePath(a: Pt, d: Pt, landing: boolean): Path {
    const b = landing ? { x: a.x + (d.x - a.x) * 0.45, y: a.y + 10 } : { x: a.x + (d.x - a.x) * 0.15, y: a.y - 40 };
    const c = landing ? { x: d.x - (d.x - a.x) * 0.18, y: d.y - 70 } : { x: a.x + (d.x - a.x) * 0.55, y: d.y + 20 };
    const p: [Pt, Pt, Pt, Pt] = [a, b, c, d];
    return { p, len: cubicLength(...p), u: 0 };
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    const sf = w.speed;
    switch (this.state) {
      case 'arrive':
      case 'depart': {
        const f = this.path;
        const k = this.state === 'arrive' ? 0.3 + 0.7 * (1 - easeInOut(f.u) ** 2) : 0.4 + f.u;
        f.u = Math.min(1, f.u + (SPEEDS.heronFlight * sf * k * dt) / Math.max(1, f.len));
        const q = cubic(...f.p, f.u);
        const tg = cubicTangent(...f.p, f.u);
        this.x = q.x;
        this.y = q.y;
        this.heading = clamp(Math.atan2(tg.y, Math.abs(tg.x)), -0.35, 0.35);
        const gliding = this.state === 'arrive' && f.u > 0.55;
        if (!gliding) this.wingT += dt * 0.85 * sf;
        if (f.u >= 1) {
          if (this.state === 'arrive') {
            this.facing = this.stand.facing;
            this.go('stand');
            w.ripple(this.x, this.y + 2, 34, 0.8);
          } else this.done = true;
        }
        if (this.state === 'depart' && isOffscreen({ x: this.x, y: this.y }, w.view, FAUNA_TUNING.offscreen * 2)) this.done = true;
        break;
      }
      case 'stand': {
        // the slowest life: neck drifting, sometimes craning forward to watch the water, a rare step
        this.neckTimer -= dt;
        if (this.neckTimer <= 0) {
          const r = w.rng.next();
          this.neckTarget = r < 0.25 ? 0.32 : r < 0.5 ? -0.08 : w.rng.range(-0.04, 0.1);
          this.neckTimer = w.rng.range(6, 16);
          if (r > 0.9 && !this.step) this.step = { from: this.x, to: this.x + this.facing * w.rng.range(5, 10), t: 0 };
        }
        this.neck = approach(this.neck, this.neckTarget + w.noise(this.timer * 0.05, this.id) * 0.04, 0.35 * sf, dt);
        if (this.step) {
          this.step.t += dt / 2.5;
          this.x = this.step.from + (this.step.to - this.step.from) * easeInOut(this.step.t);
          if (this.step.t >= 1) {
            w.ripple(this.x, this.y + 2, 18, 0.5);
            this.step = null;
          }
        }
        if (this.timer > this.stay || this.leaving) this.go('crouch');
        break;
      }
      case 'crouch':
        this.neck = approach(this.neck, -0.15, 2, dt);
        if (this.timer > 1.2) {
          const side = this.facing;
          const to = offscreenPoint(w.view, side, w.scene.skyBand.bottom - w.rng.range(20, 90), FAUNA_TUNING.offscreen * 2.5);
          this.path = this.makePath({ x: this.x, y: this.y - 4 }, to, false);
          w.ripple(this.x, this.y + 2, 40, 0.9);
          this.go('depart');
        }
        break;
    }
  }

  override depth(): number | null {
    return this.state === 'stand' || this.state === 'crouch' ? this.stand.y : null;
  }

  override leave(): void {
    this.leaving = true;
  }

  private standing(ctx: Ctx, parts: HeronParts, crouch: number): void {
    ctx.save();
    ctx.scale(1, 1 - crouch * 0.06);
    const b = parts.body;
    ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    const n = parts.neck;
    ctx.translate(parts.neckBase.x, parts.neckBase.y);
    ctx.rotate(this.neck);
    ctx.drawImage(n.img as CanvasImageSource, -n.ox, -n.oy, n.w, n.h);
    ctx.restore();
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const grounded = this.state === 'stand' || this.state === 'crouch';
    const want: LayerId = grounded ? 'entities' : 'air';
    if (layer !== want && !(grounded && layer === 'waterSurface')) return;
    const parts = w.art.get('heron', (res) => paintHeron(res, 1400));
    const ps = w.perspective(grounded ? this.stand.y : this.y + 120, grounded ? this.stand.x : this.x);
    const crouch = this.state === 'crouch' ? Math.min(1, this.timer / 1.2) : 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (layer === 'waterSurface') {
      // a faint, slightly broken reflection in front of it
      ctx.globalAlpha = 0.16;
      ctx.scale(ps * this.facing, -ps * 0.9);
      this.standing(ctx, parts, crouch);
      ctx.restore();
      return;
    }
    ctx.scale(ps * this.facing, ps);
    if (grounded) this.standing(ctx, parts, crouch);
    else {
      ctx.rotate(this.heading);
      // slow deep beats: the wing foreshortens through edge-on (k = cos) as it sweeps up and down
      const gliding = this.state === 'arrive' && this.path.u > 0.55;
      const k = gliding ? 0.22 + 0.05 * Math.sin(this.timer) : Math.cos(this.wingT * TAU);
      const sh = parts.shoulder;
      const wg = parts.wing;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.translate(sh.x + 3, sh.y - 1);
      ctx.scale(0.92, k * 0.9);
      ctx.drawImage(wg.img as CanvasImageSource, -wg.ox, -wg.oy, wg.w, wg.h);
      ctx.restore();
      const b = parts.flyBody;
      ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.scale(1, k);
      ctx.drawImage(wg.img as CanvasImageSource, -wg.ox, -wg.oy, wg.w, wg.h);
      ctx.restore();
    }
    ctx.restore();
  }
}

const heron: CreatureDef = {
  kind: 'heron',
  title: 'grey heron',
  role: 'visitor',
  visit: VISITS.heron,
  needs: (w) => w.stands().length > 0 && w.pond.world.length >= 3,
  spawn(w, s) {
    const stands = w.stands();
    if (w.pond.world.length < 3 || stands.length === 0) return [];
    return [new Heron(w, w.rng.pick(stands), s.stay || 120)];
  },
  sheet: {
    w: 720,
    h: 240,
    make(res, seed) {
      const a = paintHeron(res, seed);
      return [a.body, a.neck, a.flyBody, a.wing];
    },
  },
  show: { order: 9, spec: { w: 560, h: 360 }, w: 560, h: 360 },
};
export default heron;
