/**
 * Swallows: rare, swift arcs across the sky band — a loose group swooping down and up again in
 * one sweep from one side to the other. Seen from below: forked tail, long swept wings.
 */
import { mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { cubic, cubicLength, cubicTangent, offscreenPoint, rangeOf } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { FAUNA_TUNING, SIZES, SPEEDS, VISITS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

export interface SwallowParts {
  spread: Sprite;
  swept: Sprite;
  up: Sprite;
}

const INK = mix(PIGMENTS.sumi, PIGMENTS.bellflower, 0.22);

/** Silhouette facing +x; `wing`: angle of the wings back from perpendicular, `span` 0..1 foreshortening. */
function paintSwallow(p: Painter, S: number, sweep: number, span: number): void {
  const rng = p.rng;
  const half = S / 2;
  // wings first: long, slender, swept back into a crescent
  for (const side of [-1, 1]) {
    const a = side * (Math.PI / 2 + sweep);
    p.dab({ x: S * 0.05, y: side * S * 0.025 }, INK, { rng, variant: 'blade', angle: a, length: half * span * 1.05, width: S * 0.1, curve: -side * 0.22, opacity: 0.9, asym: side * 0.5 });
  }
  // short body, pale belly, rust throat; deep forked tail with streamers
  const body = smoothPolygon(
    [
      { x: S * 0.17, y: 0 },
      { x: S * 0.1, y: -S * 0.045 },
      { x: -S * 0.1, y: -S * 0.04 },
      { x: -S * 0.16, y: -S * 0.02 },
      { x: -S * 0.16, y: S * 0.02 },
      { x: -S * 0.1, y: S * 0.04 },
      { x: S * 0.1, y: S * 0.045 },
    ],
    2,
  );
  p.wetInWet(body, INK, mix(PIGMENTS.petalWhite, PIGMENTS.gold, 0.15), { rng, angle: 0, split: 0.45, softness: 0.3, opacity: 0.92, edge: 0.45, edgeWidth: 0.4, deform: 0.05, blend: 'source-over' });
  p.dab({ x: S * 0.13, y: 0 }, mix(PIGMENTS.vermilion, PIGMENTS.wood, 0.4), { rng, variant: 'round', angle: Math.PI, length: S * 0.05, width: S * 0.06, opacity: 0.7 });
  for (const side of [-1, 1]) {
    p.inkLine(
      [
        { x: -S * 0.14, y: side * S * 0.015 },
        { x: -S * 0.28, y: side * S * 0.05 },
        { x: -S * 0.44, y: side * S * 0.1 },
      ],
      { rng, width: S * 0.035, pigment: INK, opacity: 0.9, breaks: 0, taper: [0, 0.85], wobble: 0.1 },
    );
  }
}

export function paintSwallows(res: number, seed: number): SwallowParts {
  const S = SIZES.swallow;
  const box = { w: S * 1.1, h: S * 1.15, ox: S * 0.55, oy: S * 0.575 };
  return {
    spread: paintSprite(res, box, seed, (p) => paintSwallow(p, S, 0.25, 1)),
    swept: paintSprite(res, box, seed + 1, (p) => paintSwallow(p, S, 0.75, 0.95)),
    up: paintSprite(res, box, seed + 2, (p) => paintSwallow(p, S, 0.35, 0.45)),
  };
}

export class Swallow extends BaseCreature {
  readonly kind = 'swallow' as const;
  readonly visitor = true;
  override layer: LayerId = 'air';
  private readonly path: [Pt, Pt, Pt, Pt];
  private readonly len: number;
  private u = 0;
  private readonly speed: number;
  private delay: number;
  private heading = 0;
  private flapT: number;

  constructor(w: FaunaWorld, side: number, lane: number, delay: number) {
    super();
    const rng = w.rng;
    const sky = w.scene.skyBand;
    const v = w.view;
    const y0 = sky.top + (sky.bottom - sky.top) * rng.range(0.15, 0.6) + lane * 14;
    const y3 = sky.top + (sky.bottom - sky.top) * rng.range(0.05, 0.55) + lane * 10;
    const dip = sky.bottom + rng.range(-30, 60);
    const p0 = offscreenPoint(v, side, y0, FAUNA_TUNING.offscreen);
    const p3 = offscreenPoint(v, -side, y3, FAUNA_TUNING.offscreen);
    const p1 = { x: p0.x + (p3.x - p0.x) * rng.range(0.25, 0.4), y: dip };
    const p2 = { x: p0.x + (p3.x - p0.x) * rng.range(0.55, 0.75), y: dip - rng.range(40, 120) };
    this.path = [p0, p1, p2, p3];
    this.len = cubicLength(p0, p1, p2, p3);
    this.speed = rangeOf(rng, SPEEDS.swallow);
    this.delay = delay;
    this.flapT = rng.range(0, 10);
    this.x = p0.x;
    this.y = p0.y;
    this.state = delay > 0 ? 'wait' : 'fly';
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    this.state = 'fly';
    this.flapT += dt;
    this.u += (this.speed * w.speed * dt) / this.len;
    const [a, b, c, d] = this.path;
    const q = cubic(a, b, c, d, Math.min(1, this.u));
    const t = cubicTangent(a, b, c, d, Math.min(1, this.u));
    this.x = q.x;
    this.y = q.y;
    this.heading = Math.atan2(t.y, t.x);
    if (this.u >= 1) this.done = true;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'air' || this.state === 'wait') return;
    const parts = w.art.get(`swallow:${this.id % 2}`, (res) => paintSwallows(res, 1300 + (this.id % 2) * 3));
    // bursts of quick wingbeats between long swept glides
    const burst = Math.sin(this.flapT * 1.7) > 0.2;
    const ph = (this.flapT * 9) % 1;
    const s = burst ? (ph < 0.5 ? parts.spread : parts.up) : parts.swept;
    const ps = w.perspective(this.y);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);
    ctx.scale(ps, ps * 0.85);
    ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  }
}

const swallow: CreatureDef = {
  kind: 'swallow',
  title: 'swallows',
  role: 'visitor',
  visit: VISITS.swallow,
  spawnCount: 3,
  spawn(w, s) {
    const side = w.rng.chance(0.5) ? -1 : 1;
    const out: Swallow[] = [];
    for (let i = 0; i < s.count; i++) out.push(new Swallow(w, side, i, i === 0 ? 0 : w.rng.range(0.15, 0.9) * i));
    return out;
  },
  sheet: {
    w: 420,
    h: 130,
    make(res, seed) {
      const a = paintSwallows(res, seed);
      return [a.spread, a.up, a.swept];
    },
  },
  show: { order: 8, spec: { w: 700, h: 320 }, w: 560, h: 256, group: 3 },
};
export default swallow;
