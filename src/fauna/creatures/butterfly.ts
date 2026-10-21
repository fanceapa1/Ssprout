/**
 * Butterflies (cabbage white, swallowtail): flutter in on erratic, bobbing paths, settle on a
 * flower for a few breaths with wings slowly opening and closing, visit one or two more, and
 * drift away. Seen from above; each wing is drawn foreshortened by the flap.
 */
import { blob, mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { approach, clamp, dist, isOffscreen, springStep, TAU } from '../math';
import type { FlowerTarget } from '../targets';
import { paintSprite, type Sprite } from '../sprite';
import { FAUNA_TUNING, SIZES, SPEEDS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { entryPoint, exitPoint, nextFlower } from './flight';

export type ButterflySpecies = 'white' | 'swallowtail';

export interface ButterflyParts {
  wingR: Sprite;
  wingL: Sprite;
  body: Sprite;
  span: number;
}

function forewing(W: number): Pt[] {
  return smoothPolygon(
    [
      { x: 0.3, y: -0.6 },
      { x: W * 0.35, y: -W * 0.62 },
      { x: W * 0.85, y: -W * 0.82 },
      { x: W * 1.0, y: -W * 0.66 },
      { x: W * 0.9, y: -W * 0.25 },
      { x: W * 0.62, y: W * 0.02 },
      { x: W * 0.12, y: W * 0.06 },
    ],
    2,
  );
}

function hindwing(W: number, tail: boolean): Pt[] {
  const pts = [
    { x: 0.3, y: W * 0.02 },
    { x: W * 0.62, y: -W * 0.02 },
    { x: W * 0.76, y: W * 0.22 },
    { x: W * 0.66, y: W * 0.52 },
  ];
  if (tail) pts.push({ x: W * 0.5, y: W * 0.62 }, { x: W * 0.44, y: W * 0.92 }, { x: W * 0.36, y: W * 0.66 });
  pts.push({ x: W * 0.22, y: W * 0.62 }, { x: W * 0.06, y: W * 0.36 });
  return smoothPolygon(pts, 2);
}

function paintWing(p: Painter, W: number, species: ButterflySpecies): void {
  const rng = p.rng;
  const fw = forewing(W);
  const hw = hindwing(W, species === 'swallowtail');
  if (species === 'white') {
    const white = PIGMENTS.petalWhite;
    p.wash(hw, mix(white, PIGMENTS.gold, 0.12), { rng, blend: 'source-over', opacity: 0.92, edge: 0.4, edgeWidth: 0.8, deform: 0.12 });
    p.wash(fw, white, { rng, blend: 'source-over', opacity: 0.95, edge: 0.4, edgeWidth: 0.8, deform: 0.12 });
    const L = p.layer({ x: -1, y: -W, w: W * 1.2, h: W * 1.8 });
    L.clip(fw);
    const apex = blob(W * 0.92, -W * 0.72, W * 0.2, W * 0.13, rng, { irregularity: 0.3 });
    for (let k = 0; k < 3; k++) L.fill(apex, mix(PIGMENTS.sumi, PIGMENTS.stone, 0.4), 0.3);
    const spot = blob(W * 0.55, -W * 0.36, W * 0.06, W * 0.055, rng, { irregularity: 0.2 });
    for (let k = 0; k < 3; k++) L.fill(spot, PIGMENTS.sumi, 0.3);
    L.dry({ opacity: 0.8, edge: 0.5, edgeWidth: 0.6 });
    const B = p.layer({ x: -1, y: -W, w: W * 1.2, h: W * 1.8 });
    B.clip([...fw, ...hw]);
    B.fill(blob(W * 0.08, 0, W * 0.3, W * 0.3, rng), PIGMENTS.petalShade, 0.35);
    B.dry({ opacity: 0.5, edge: 0.1, sharpness: 0.2 });
  } else {
    const cream = mix(PIGMENTS.petalWhite, PIGMENTS.gold, 0.42);
    p.wash(hw, cream, { rng, blend: 'source-over', opacity: 0.92, edge: 0.45, edgeWidth: 0.8, deform: 0.1 });
    p.wash(fw, cream, { rng, blend: 'source-over', opacity: 0.94, edge: 0.45, edgeWidth: 0.8, deform: 0.1 });
    // sumi bands along the margins and the base, then veins
    const ink = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.15);
    for (const [poly, k] of [
      [fw, 0.87],
      [hw, 0.82],
    ] as const) {
      const L = p.layer({ x: -1, y: -W, w: W * 1.2, h: W * 2 });
      L.clip(poly);
      const outer = poly.map((q) => ({ x: q.x * 1.6, y: q.y * 1.6 }));
      const inner = poly.map((q) => ({ x: q.x * k, y: q.y * k }));
      L.fill(outer, ink, 0.4);
      L.lift(inner, 1);
      L.fill(blob(0, 0, W * 0.22, W * 0.24, rng), ink, 0.35);
      L.dry({ opacity: 0.6, edge: 0.45, edgeWidth: 0.6, flow: 0.5, flowScale: 6 });
    }
    for (let i = 0; i < 4; i++) {
      const a = -0.95 + i * 0.25;
      p.inkLine([{ x: 1, y: -0.5 }, { x: Math.cos(a) * W * 0.85, y: Math.sin(a) * W * 0.85 }], { rng, width: 0.25, opacity: 0.25, breaks: 0.3 });
    }
    p.dab({ x: W * 0.4, y: W * 0.58 }, PIGMENTS.bellflower, { rng, variant: 'round', angle: 0, length: 1.6, width: 1.3, opacity: 0.7 });
    p.dab({ x: W * 0.2, y: W * 0.62 }, PIGMENTS.vermilion, { rng, variant: 'round', angle: 0, length: 1.6, width: 1.3, opacity: 0.7 });
  }
}

export function paintButterfly(res: number, seed: number, species: ButterflySpecies): ButterflyParts {
  const span = species === 'white' ? SIZES.butterfly : SIZES.swallowtail;
  const W = span / 2;
  const box = { w: W * 1.15, h: W * 2, ox: 0.4, oy: W * 0.95 };
  const wingR = paintSprite(res, box, seed, (p) => paintWing(p, W, species));
  const wingL = paintSprite(res, box, seed + 1, (p) => paintWing(p, W, species));
  const body = paintSprite(res, { w: W * 0.6, h: W * 1.4, ox: W * 0.3, oy: W * 0.75 }, seed + 2, (p, rng) => {
    const dark = mix(PIGMENTS.sumi, species === 'white' ? PIGMENTS.stone : PIGMENTS.wood, 0.3);
    p.dab({ x: 0, y: -W * 0.42 }, dark, { rng, variant: 'leaf', angle: Math.PI / 2, length: W * 0.95, width: W * 0.13, opacity: 0.85 });
    p.dab({ x: 0, y: -W * 0.42 }, dark, { rng, variant: 'round', angle: -Math.PI / 2, length: W * 0.14, width: W * 0.13, opacity: 0.9 });
    for (const side of [-1, 1]) {
      p.inkLine(
        [
          { x: side * 0.4, y: -W * 0.52 },
          { x: side * W * 0.12, y: -W * 0.66 },
          { x: side * W * 0.22, y: -W * 0.72 },
        ],
        { rng, width: 0.22, opacity: 0.6, breaks: 0 },
      );
    }
  });
  return { wingR, wingL, body, span };
}

export class Butterfly extends BaseCreature {
  readonly kind = 'butterfly' as const;
  readonly visitor = true;
  override layer: LayerId = 'air';
  readonly species: ButterflySpecies;
  private pos: Pt;
  private vel: Pt = { x: 0, y: 0 };
  private flower: FlowerTarget | null = null;
  private target: Pt;
  private visits: number;
  private readonly stay: number;
  private phase = 0;
  private open = 1;
  private tilt = 0;
  private glide = 0;
  private perchFor = 0;
  private readonly cruise: number;
  private readonly hz: number;

  constructor(w: FaunaWorld, stay: number, species?: ButterflySpecies) {
    super();
    const rng = w.rng;
    this.species = species ?? (rng.chance(0.65) ? 'white' : 'swallowtail');
    this.stay = stay;
    this.visits = rng.int(2, 4);
    this.cruise = rng.range(SPEEDS.butterfly[0], SPEEDS.butterfly[1]) * (this.species === 'white' ? 1 : 0.85);
    this.hz = this.species === 'white' ? rng.range(7.5, 9.5) : rng.range(4.5, 5.5);
    this.pos = entryPoint(w.view, rng, 0.35, 0.75);
    this.phase = rng.range(0, TAU);
    this.target = this.pickTarget(w);
    this.state = 'fly';
    this.sync();
  }

  private pickTarget(w: FaunaWorld): Pt {
    this.flower = nextFlower(w.flowers, this.pos, w.rng, this.flower?.plantId ?? null, 260);
    if (this.flower) return { x: this.flower.x, y: this.flower.y };
    // nothing in flower: wander over the near banks
    const v = w.view;
    return { x: v.x + v.w * w.rng.range(0.15, 0.85), y: v.y + v.h * w.rng.range(0.55, 0.85) };
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    const sf = w.speed;
    if (!this.leaving && this.timer > this.stay && this.state !== 'perch') this.leaving = true;
    if (this.leaving && this.state !== 'leave') {
      this.target = exitPoint(w.view, this.pos, w.rng, 120);
      this.go('leave');
    }
    switch (this.state) {
      case 'fly':
      case 'leave': {
        // erratic: heading wanders on a noise field around the way to the target
        const d = dist(this.pos, this.target);
        const toward = Math.atan2(this.target.y - this.pos.y, this.target.x - this.pos.x);
        const wander = w.noise(this.timer * 0.55, this.id * 1.7) * (d > 50 ? 1.2 : 0.5);
        const sp = this.cruise * sf * (d < 40 ? 0.45 + 0.55 * (d / 40) : 1);
        this.vel.x = approach(this.vel.x, Math.cos(toward + wander) * sp, 2.2, dt);
        this.vel.y = approach(this.vel.y, Math.sin(toward + wander) * sp, 2.2, dt);
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        // each downstroke lifts it a little: the bobbing flight
        this.pos.y -= Math.max(0, Math.sin(this.phase)) * 9 * dt * (this.glide > 0 ? 0 : 1);
        this.flapping(dt, w);
        if (this.state === 'leave') {
          if (isOffscreen(this.pos, w.view, FAUNA_TUNING.offscreen)) this.done = true;
        } else if (d < 14) {
          this.go(this.flower ? 'land' : 'fly');
          if (!this.flower) {
            this.visits--;
            this.target = this.pickTarget(w);
          }
        }
        break;
      }
      case 'land': {
        springStep(this.pos, this.vel, this.target, 3.2 * sf, dt);
        this.flapping(dt, w, 0.6);
        if (dist(this.pos, this.target) < 1.2) {
          this.go('perch');
          this.perchFor = w.rng.range(2.5, 7) / sf;
        }
        break;
      }
      case 'perch': {
        // wings fold up and slowly breathe open; a small turn now and then
        this.vel.x = 0;
        this.vel.y = 0;
        this.open = approach(this.open, 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(this.timer * 1.3 * sf + this.id)), 3, dt);
        this.tilt = approach(this.tilt, w.noise(this.timer * 0.2, this.id) * 0.5, 1, dt);
        if (this.timer > this.perchFor) {
          this.visits--;
          if (this.visits <= 0 || this.leaving) this.leaving = true;
          else {
            this.target = this.pickTarget(w);
            this.go('fly');
          }
          this.vel = { x: 0, y: -this.cruise * 0.6 };
        }
        break;
      }
    }
    this.sync();
  }

  private flapping(dt: number, w: FaunaWorld, k = 1): void {
    // swallowtails glide between bursts of flaps; whites flap almost all the time
    if (this.glide > 0) this.glide -= dt;
    else if (w.rng.chance(dt * (this.species === 'white' ? 0.15 : 0.6))) this.glide = w.rng.range(0.3, 0.8);
    if (this.glide > 0) {
      this.open = approach(this.open, 0.85, 6, dt);
    } else {
      this.phase += dt * TAU * this.hz * k * w.speed;
      this.open = 0.16 + 0.84 * (0.5 + 0.5 * Math.cos(this.phase));
    }
    this.tilt = approach(this.tilt, clamp(this.vel.x * 0.012, -0.45, 0.45), 3, dt);
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'air') return;
    const variant = this.id % 2;
    const parts = w.art.get(`butterfly:${this.species}:${variant}`, (res) => paintButterfly(res, 500 + variant * 10 + (this.species === 'white' ? 0 : 5), this.species));
    const ps = w.perspective(this.y + 40);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps * 0.9, ps * 0.8);
    ctx.rotate(this.tilt);
    const o = Math.max(0.06, this.open);
    for (const [s, dir] of [
      [parts.wingL, -1],
      [parts.wingR, 1],
    ] as const) {
      ctx.save();
      ctx.scale(dir * o, 1);
      ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    }
    const b = parts.body;
    ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    ctx.restore();
  }
}
