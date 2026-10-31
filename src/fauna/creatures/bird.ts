/**
 * Small birds (wagtail, sparrow): fly in on a bounding path, land on a perch rock or a stepping
 * stone, hop about, peck, bob the tail (wagtail), and fly off again. On the ground they are
 * depth-sorted entities; in flight they are on the air layer. Side view, painted facing right.
 */
import { blob, lighten, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, cubic, cubicLength, cubicTangent, easeInOut, isOffscreen, lerp, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { choosePerch, perchY, type Perch } from '../targets';
import { FAUNA_TUNING, SIZES, SPEEDS, VISITS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { variantOf, type CreatureDef } from './lib/def';
import { entryPoint, exitPoint } from './lib/flight';

export const BIRD_VARIANTS = ['wagtail', 'sparrow'] as const;
export type BirdSpecies = (typeof BIRD_VARIANTS)[number];

export interface BirdParts {
  body: Sprite; // standing/perched body without legs or tail, anchored at the hip
  legs: Sprite; // anchored at the feet
  tail: Sprite; // anchored at its root, pointing back (−x)
  flyUp: Sprite; // flight frames, anchored at the body centre, tail included
  flyDown: Sprite;
  fold: Sprite;
  size: number;
}

interface Colours {
  back: Pigment;
  belly: Pigment;
  cap: Pigment;
  face: Pigment;
  wing: Pigment;
  tail: Pigment;
  bib: Pigment | null;
  streak: Pigment;
}

function colours(species: BirdSpecies): Colours {
  if (species === 'sparrow') {
    return {
      back: mix(PIGMENTS.wood, PIGMENTS.gold, 0.25),
      belly: mix(PIGMENTS.petalWhite, PIGMENTS.stone, 0.35),
      cap: mix(PIGMENTS.wood, PIGMENTS.vermilion, 0.18),
      face: PIGMENTS.petalWhite,
      wing: mix(PIGMENTS.wood, PIGMENTS.sumi, 0.2),
      tail: mix(PIGMENTS.wood, PIGMENTS.sumi, 0.35),
      bib: mix(PIGMENTS.sumi, PIGMENTS.wood, 0.2),
      streak: mix(PIGMENTS.sumi, PIGMENTS.wood, 0.3),
    };
  }
  const ink = mix(PIGMENTS.sumi, PIGMENTS.stone, 0.15);
  return {
    back: mix(PIGMENTS.stone, PIGMENTS.sumi, 0.6),
    belly: PIGMENTS.petalWhite,
    cap: ink,
    face: PIGMENTS.petalWhite,
    wing: ink,
    tail: ink,
    bib: ink,
    streak: lighten(PIGMENTS.stone, 0.2),
  };
}

/** Body (with head) in sprite units: hip at the origin, head toward +x. `pitch` tilts it. */
function paintBody(p: Painter, S: number, c: Colours, species: BirdSpecies, opts: { pitch: number; wing: 'fold' | 'up' | 'down' }): void {
  const rng = p.rng;
  const ctx = p.ctx;
  ctx.save();
  ctx.rotate(opts.pitch);
  const r = S / 17; // proportions authored for a 17-unit sparrow
  const sx = species === 'wagtail' ? 1.12 : 1; // wagtails are slimmer and longer
  const sy = species === 'wagtail' ? 0.9 : 1;
  const P = (x: number, y: number) => ({ x: x * r * sx, y: y * r * sy });
  // one silhouette for head and body (hip at the origin, beak toward +x)
  const sil = smoothPolygon(
    [P(8.1, -8.5), P(7.0, -10.0), P(5.4, -10.4), P(3.2, -9.3), P(0.2, -7.6), P(-3.6, -5.5), P(-5.8, -3.8), P(-4.6, -2.3), P(-1.6, -1.0), P(1.6, -1.2), P(4.4, -3.2), P(6.3, -5.6), P(7.4, -7.0), P(8.2, -7.7)],
    2,
  );
  const head = P(5.6, -8.2);
  p.wetInWet(sil, c.back, c.belly, { rng, angle: Math.PI / 2 + 0.3, split: 0.6, softness: 0.3, fingers: 0.3, opacity: 0.94, edge: 0.45, edgeWidth: 0.55, deform: 0.08, blend: 'source-over' });
  // markings, clipped to the silhouette
  const M = p.layer({ x: -8 * r, y: -12 * r, w: 18 * r, h: 13 * r });
  M.clip(sil);
  if (species === 'sparrow') {
    M.fill(blob(head.x - 0.6 * r, head.y - 1.6 * r, 3.4 * r, 1.7 * r, rng, { rotation: -0.2 }), c.cap, 0.85); // chestnut crown
    M.fill(blob(head.x - 0.5 * r, head.y + 0.9 * r, 0.9 * r, 0.8 * r, rng), PIGMENTS.sumi, 0.6); // cheek spot
    if (c.bib) M.fill(blob(head.x + 1.6 * r, head.y + 2.4 * r, 1.2 * r, 1.4 * r, rng), c.bib, 0.75);
  } else {
    M.fill(blob(head.x - 1.2 * r, head.y - 1.4 * r, 3.8 * r, 1.5 * r, rng, { rotation: -0.15 }), c.cap, 0.9); // black crown and nape
    if (c.bib) M.fill(blob(head.x + 0.4 * r, head.y + 3.4 * r, 2.6 * r, 1.8 * r, rng), c.bib, 0.85); // black bib
  }
  M.dry({ opacity: 0.85, edge: 0.4, edgeWidth: 0.5, flow: 0.4, flowScale: 4 });
  // beak and eye
  p.dab(P(8.0, -8.1), mix(PIGMENTS.sumi, PIGMENTS.stone, 0.3), { rng, variant: 'leaf', angle: 0.12, length: (species === 'sparrow' ? 2 : 2.3) * r, width: 1.05 * r, opacity: 0.85 });
  p.dab(P(6.4, -8.7), PIGMENTS.sumi, { rng, variant: 'round', angle: 0, length: 0.85 * r, width: 0.85 * r, opacity: 0.95 });
  // wing
  const shoulder = P(2.8, -7.0);
  if (opts.wing === 'fold') {
    p.dab({ x: shoulder.x, y: shoulder.y + 0.7 * r }, c.wing, { rng, variant: 'leaf', angle: Math.PI - 0.3, length: 8.2 * r * sx, width: 3.3 * r, curve: 0.06, opacity: 0.85 });
    for (let k = 0; k < 3; k++) {
      const y = shoulder.y + (0.5 + k * 0.7) * r;
      p.inkLine([{ x: shoulder.x - 2 * r, y }, { x: shoulder.x - 6.6 * r * sx, y: y + 1.1 * r }], { rng, width: 0.22 * r, opacity: 0.4, breaks: 0.3, pigment: c.streak });
    }
  } else {
    const up = opts.wing === 'up';
    const a = up ? -Math.PI / 2 - 0.7 : Math.PI / 2 + 0.5;
    p.dab(shoulder, c.wing, { rng, variant: 'leaf', angle: a, length: 10 * r, width: 3.6 * r, curve: up ? 0.16 : -0.16, opacity: 0.72 });
    for (let k = 0; k < 4; k++) {
      const t = 0.45 + k * 0.14;
      p.inkLine(
        [
          { x: shoulder.x + Math.cos(a) * 4 * r * t, y: shoulder.y + Math.sin(a) * 4 * r * t },
          { x: shoulder.x + Math.cos(a - 0.3) * 10 * r * t, y: shoulder.y + Math.sin(a - 0.3) * 10 * r * t },
        ],
        { rng, width: 0.2 * r, opacity: 0.35, pigment: c.streak },
      );
    }
  }
  ctx.restore();
}

function paintTail(p: Painter, S: number, c: Colours, species: BirdSpecies): void {
  const rng = p.rng;
  const len = species === 'wagtail' ? S * 0.5 : S * 0.32;
  p.dab({ x: 0, y: 0 }, c.tail, { rng, variant: 'blade', angle: Math.PI - 0.08, length: len, width: len * (species === 'wagtail' ? 0.22 : 0.36), opacity: 0.88 });
  if (species === 'wagtail') p.inkLine([{ x: -len * 0.2, y: 0.5 }, { x: -len * 0.95, y: 0.8 }], { rng, width: 0.35, opacity: 0.5, pigment: PIGMENTS.petalWhite, blend: 'source-over' });
}

export function paintBird(res: number, seed: number, species: BirdSpecies): BirdParts {
  const S = species === 'wagtail' ? SIZES.wagtail * 0.78 : SIZES.sparrow;
  const c = colours(species);
  const box = { w: S * 1.3, h: S * 1.2, ox: S * 0.55, oy: S * 0.85 };
  const body = paintSprite(res, box, seed, (p) => paintBody(p, S, c, species, { pitch: -0.12, wing: 'fold' }));
  const legs = paintSprite(res, { w: S * 0.5, h: S * 0.4, ox: S * 0.2, oy: S * 0.36 }, seed + 1, (p, rng) => {
    const r = S / 17;
    const leg = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.4);
    for (const [hx, fx] of [
      [-0.4, 0.2],
      [0.9, 1.9],
    ] as const) {
      p.inkLine([{ x: hx * r, y: -3.6 * r }, { x: fx * r, y: 0 }], { rng, width: 0.35 * r, opacity: 0.8, pigment: leg, breaks: 0 });
      p.inkLine([{ x: fx * r - 1.1 * r, y: 0 }, { x: fx * r + 1.4 * r, y: 0.1 }], { rng, width: 0.25 * r, opacity: 0.6, pigment: leg, breaks: 0 });
    }
  });
  const tail = paintSprite(res, { w: S * 0.65, h: S * 0.3, ox: S * 0.58, oy: S * 0.15 }, seed + 2, (p) => paintTail(p, S, c, species));
  const flyBox = { w: S * 1.8, h: S * 1.6, ox: S * 0.85, oy: S * 0.8 };
  const fly = (wing: 'up' | 'down' | 'fold', k: number) =>
    paintSprite(res, flyBox, seed + 3 + k, (p) => {
      p.ctx.save();
      p.ctx.translate(-S * 0.33, S * 0.2);
      p.ctx.save();
      p.ctx.translate(-S * 0.26, -S * 0.25);
      p.ctx.rotate(0.2);
      paintTail(p, S, c, species);
      p.ctx.restore();
      paintBody(p, S, c, species, { pitch: 0.18, wing });
      p.ctx.restore();
    });
  return { body, legs, tail, flyUp: fly('up', 0), flyDown: fly('down', 1), fold: fly('fold', 2), size: S };
}

// ---------------------------------------------------------------------------------------------

interface Flight {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
  len: number;
  u: number;
}

function flightTo(from: Pt, to: Pt, landing: boolean, rng: FaunaWorld['rng']): Flight {
  const dx = to.x - from.x;
  const p1 = { x: from.x + dx * 0.35, y: from.y + rng.range(-30, 10) };
  const p2 = landing ? { x: to.x - dx * 0.25, y: to.y - rng.range(50, 80) } : { x: from.x + dx * 0.65, y: to.y + rng.range(-20, 40) };
  const f = { p0: { ...from }, p1, p2, p3: { ...to }, len: 0, u: 0 };
  f.len = cubicLength(f.p0, f.p1, f.p2, f.p3);
  return f;
}

export class Bird extends BaseCreature {
  readonly kind = 'bird' as const;
  readonly visitor = true;
  readonly species: BirdSpecies;
  perch: Perch | null = null;
  private pos: Pt;
  private flight: Flight | null = null;
  private facing = 1;
  private readonly stay: number;
  private act = 0;
  private actFor = 1;
  private flap = 0;
  private hopFrom = 0;
  private hopTo = 0;
  private pitch = 0;
  private tailAngle = 0;
  private pecks = 0;
  private heading = 0;
  private timerAct = 0;

  constructor(w: FaunaWorld, stay: number, taken: readonly Pt[], variants: readonly string[] = []) {
    super();
    const rng = w.rng;
    this.stay = stay;
    this.species = variantOf(variants, BIRD_VARIANTS, rng, () => (rng.chance(0.5) ? 'wagtail' : 'sparrow'));
    this.variant = this.species;
    this.perch = choosePerch(w.perches, taken, rng, this.species === 'wagtail' ? 'rock' : 'stone');
    const sky = w.scene.skyBand;
    const side = rng.chance(0.5) ? -1 : 1;
    this.pos = entryPoint(w.view, rng, 0, 0, side);
    this.pos.y = lerp(sky.bottom, sky.bottom + (w.pond.bounds.y - sky.bottom) * 0.5, rng.next());
    this.state = 'arrive';
    this.layer = 'air';
    if (this.perch) {
      const land = { x: this.perch.x + rng.range(-0.5, 0.5) * this.perch.spread, y: 0 };
      land.y = perchY(this.perch, land.x);
      this.flight = flightTo(this.pos, land, true, rng);
    } else this.done = true;
    this.sync();
  }

  /** Where it stands or will land (for spacing other birds). */
  spot(): Pt | null {
    return this.flight && this.state === 'arrive' ? this.flight.p3 : this.state === 'ground' ? { x: this.x, y: this.y } : null;
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    this.timer += dt;
    const sf = w.speed;
    if (this.state === 'arrive' || this.state === 'depart') {
      const f = this.flight!;
      const speed = SPEEDS.birdFlight * sf;
      // slow into the landing, speed up after take-off
      const k = this.state === 'arrive' ? 0.35 + 0.65 * (1 - easeInOut(f.u) ** 3) : 0.5 + f.u;
      f.u = Math.min(1, f.u + (speed * k * dt) / Math.max(1, f.len));
      const q = cubic(f.p0, f.p1, f.p2, f.p3, f.u);
      const tg = cubicTangent(f.p0, f.p1, f.p2, f.p3, f.u);
      // bounding flight: flap bursts and folded glides make the path undulate
      this.flap += dt * (this.species === 'wagtail' ? 1 : 1.3) * sf;
      const bound = this.state === 'arrive' ? (1 - f.u) : 1;
      this.pos = { x: q.x, y: q.y + Math.sin(this.flap * 4.2) * 5 * bound };
      if (Math.abs(tg.x) > 1e-3) this.facing = Math.sign(tg.x);
      this.heading = clamp(Math.atan2(tg.y, Math.abs(tg.x)), -0.5, 0.5);
      if (f.u >= 1) {
        if (this.state === 'arrive') {
          this.layer = 'entities';
          this.go('ground');
          this.nextAct(w);
        } else this.done = true;
      }
      if (this.state === 'depart' && isOffscreen(this.pos, w.view, FAUNA_TUNING.offscreen)) this.done = true;
    } else if (this.state === 'ground') {
      this.groundStep(dt, w);
      if ((this.timer > this.stay || this.leaving) && this.act !== 1) this.takeOff(w);
    }
    this.sync();
  }

  private nextAct(w: FaunaWorld): void {
    const rng = w.rng;
    const r = rng.next();
    this.pitch = 0;
    if (r < 0.35) {
      // hop along the perch
      const p = this.perch!;
      this.act = 1;
      this.actFor = 0.28;
      this.hopFrom = this.pos.x;
      let to = this.pos.x + rng.range(4, 12) * (rng.chance(0.6) ? this.facing : -this.facing);
      to = clamp(to, p.x - p.spread, p.x + p.spread);
      this.hopTo = to;
      if (Math.abs(to - this.pos.x) > 0.5) this.facing = Math.sign(to - this.pos.x);
    } else if (r < 0.6) {
      this.act = 2; // peck
      this.pecks = rng.int(1, 3);
      this.actFor = this.pecks * 0.32;
    } else if (r < 0.75) {
      this.act = 3; // turn round
      this.facing = -this.facing;
      this.actFor = rng.range(0.6, 1.6);
    } else {
      this.act = 0; // stand, look about
      this.actFor = rng.range(0.8, 2.6);
    }
    this.actFor /= w.speed;
    if (this.act === 0 && rng.chance(0.3)) this.facing = -this.facing;
    this.timerAct = 0;
  }

  private groundStep(dt: number, w: FaunaWorld): void {
    this.timerAct += dt;
    const k = clamp(this.timerAct / this.actFor, 0, 1);
    const p = this.perch!;
    if (this.act === 1) {
      const x = lerp(this.hopFrom, this.hopTo, k);
      this.pos = { x, y: perchY(p, x) - Math.sin(k * Math.PI) * 4 };
    } else if (this.act === 2) {
      const t = (this.timerAct % 0.32) / 0.32;
      this.pitch = Math.sin(t * Math.PI) * 0.5;
    }
    // tails: the wagtail pumps constantly, the sparrow flicks now and then
    const t = w.t + this.id;
    this.tailAngle = this.species === 'wagtail' ? 0.28 * Math.max(0, Math.sin(t * TAU * 1.6)) ** 2 - 0.05 : 0.12 * Math.max(0, Math.sin(t * 2.3)) ** 8;
    if (k >= 1) this.nextAct(w);
  }

  private takeOff(w: FaunaWorld): void {
    const to = exitPoint(w.view, this.pos, w.rng, 160, w.rng.chance(0.5) ? -1 : 1);
    this.flight = flightTo(this.pos, to, false, w.rng);
    this.flight.p1 = { x: this.pos.x + (to.x - this.pos.x) * 0.15, y: this.pos.y - 50 };
    this.layer = 'air';
    this.go('depart');
  }

  override leave(): void {
    this.leaving = true;
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    return this.state === 'ground' && this.perch ? this.perch.depth : null;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const ground = this.state === 'ground';
    if ((ground && layer !== 'entities') || (!ground && layer !== 'air')) return;
    const variant = this.id % 2;
    const parts = w.art.get(`bird:${this.species}:${variant}`, (res) => paintBird(res, 800 + variant * 7 + (this.species === 'wagtail' ? 3 : 0), this.species));
    const ps = w.perspective(ground ? this.perch!.depth : this.y + 80) * 1.0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps * this.facing, ps);
    const S = parts.size;
    if (ground) {
      const legs = parts.legs;
      ctx.drawImage(legs.img as CanvasImageSource, -legs.ox, -legs.oy, legs.w, legs.h);
      ctx.translate(0, -3.4 * (S / 17));
      ctx.rotate(this.pitch);
      // the wagtail's whole rear bobs with its tail
      const tail = parts.tail;
      ctx.save();
      ctx.translate(-4.6 * (S / 17), -2.6 * (S / 17));
      ctx.rotate(-0.25 + this.tailAngle - this.pitch * 0.8); // the tail stays level while the head goes down
      ctx.drawImage(tail.img as CanvasImageSource, -tail.ox, -tail.oy, tail.w, tail.h);
      ctx.restore();
      ctx.rotate(this.tailAngle * -0.12);
      const b = parts.body;
      ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    } else {
      ctx.rotate(this.heading);
      const cyc = (this.flap * 4.2) % TAU;
      // bursts of wingbeats, then a short glide with folded wings
      const gliding = Math.sin(this.flap * 1.3) > 0.45 && this.state !== 'depart';
      const s = gliding ? parts.fold : Math.sin(cyc * 3) > 0 ? parts.flyUp : parts.flyDown;
      ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
    }
    ctx.restore();
  }
}

const bird: CreatureDef = {
  kind: 'bird',
  title: 'small birds',
  role: 'visitor',
  visit: VISITS.bird,
  variants: BIRD_VARIANTS,
  needs: (w) => w.perches.length > 0,
  spawn(w, s) {
    const taken: Pt[] = [];
    for (const c of w.creatures) if (c instanceof Bird && !c.done) taken.push(...(c.spot() ? [c.spot()!] : []));
    const out: Bird[] = [];
    for (let i = 0; i < s.count; i++) {
      const b = new Bird(w, (s.stay || 30) * w.rng.range(0.8, 1.2), taken, s.variants);
      if (b.done) break;
      const spot = b.spot();
      if (spot) taken.push(spot);
      out.push(b);
    }
    return out;
  },
  sheet: {
    w: 700,
    h: 200,
    make(res, seed) {
      const a = paintBird(res, seed, 'wagtail');
      const b = paintBird(res, seed + 5, 'sparrow');
      return [a.body, a.tail, a.legs, a.flyUp, a.flyDown, b.body, b.tail, b.flyUp, b.fold];
    },
  },
  show: { order: 6, spec: { w: 300, h: 190 }, w: 570, h: 361 },
};
export default bird;
