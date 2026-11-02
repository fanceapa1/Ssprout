/**
 * Genji firefly (ゲンジボタル, Nipponoluciola cruciata): the waterfall's night signature. After dark
 * a swarm of slow lights drifts low over the stream and the pool's margin, each swelling and fading
 * over a few seconds; they fall into step with each other, and some rest on the bank and pulse
 * there. The light is a painted pale dab with a wet yellow-green halo whose opacity breathes; the
 * body (black, red-orange pronotum) shows only in close views. docs/systems/fauna.md.
 */
import type { Rng } from '../../core/rng';
import { blob, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, closestOnPolygon, dist, insideWithMargin, lerp, pointInPolygon, randomPointInside, rangeOf, smoothstep, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

export const FIREFLY_TUNING = {
  /** lights in a swarm, and in reduced motion */
  lights: [9, 16] as const,
  reducedLights: [5, 8] as const,
  /** seconds per flash: the eastern Genji's slow ~4 s rhythm */
  period: [3.7, 4.4] as const,
  /** phase pull toward the swarm's mean rhythm (rad/s at full order) */
  coupling: 0.7,
  /** random phase wander (rad/√s): they tend to sync, never perfectly */
  wander: 0.12,
  /** world units / s in flight */
  speed: [4, 9] as const,
  /** flight height over the water (world units at perspective 1) */
  height: [5, 20] as const,
  /** seconds in flight, at rest */
  fly: [14, 45] as const,
  rest: [8, 30] as const,
  /** share of the swarm that starts on the bank */
  restStart: 0.5,
  /** the first lights come on over this many seconds after the swarm arrives */
  arrive: [0, 50] as const,
  /** they go dark one by one over this long when leaving */
  leave: [0, 35] as const,
  /** the foam at the falls' foot, kept clear by this ellipse around `scene.falls.foot` */
  foam: { rx: 92, ry: 36 },
  /** flight stays within this of the still pool's edge (its margin, not the middle) */
  margin: 60,
};

const C = {
  halo: '#d8d97a',
  haloRim: '#b8c06a',
  inner: '#eef0b4',
  core: '#fbfae4',
  body: '#3b3733',
  pronotum: '#c9603e',
  lantern: '#e9e7b8',
};

// ---------------------------------------------------------------------------------------------
// art

export interface FireflyParts {
  halos: Sprite[]; // the wet bloom round the light, three shapes
  core: Sprite; // the pale reserved spot
  body: Sprite; // seen from above, head right: black wings, red-orange pronotum, pale lantern
}

function paintHalo(p: Painter, rng: Rng): void {
  // a soft wet dab with a faint dried rim, bled round the light
  p.wash(blob(0, 0, 6.4, 5.8, rng, { irregularity: 0.24 }), C.halo, {
    rng,
    opacity: 0.5,
    edge: 0.3,
    edgeWidth: 0.9,
    darken: 0.12,
    sharpness: 0.2,
    centreLift: 0,
    granulation: 0.12,
    flow: 0.45,
    flowScale: 5,
    deform: 0.3,
    spread: 0.22,
    blend: 'source-over',
  });
  p.wash(blob(rng.range(-0.4, 0.4), rng.range(-0.4, 0.4), 3.4, 3.1, rng, { irregularity: 0.2 }), C.inner, {
    rng,
    opacity: 0.6,
    edge: 0,
    sharpness: 0.1,
    centreLift: 0,
    granulation: 0,
    flow: 0.3,
    flowScale: 3,
    blend: 'source-over',
  });
}

export function paintFirefly(res: number, seed: number): FireflyParts {
  const halos = [0, 1, 2].map((i) => paintSprite(res, { w: 17, h: 17, ox: 8.5, oy: 8.5 }, seed + i * 7, (p, rng) => paintHalo(p, rng)));
  const core = paintSprite(res, { w: 5, h: 5, ox: 2.5, oy: 2.5 }, seed + 31, (p, rng) => {
    p.wash(blob(0, 0, 1.5, 1.35, rng, { irregularity: 0.15 }), C.core, { rng, opacity: 1, edge: 0.05, sharpness: 0.35, centreLift: 0, granulation: 0, flow: 0.1, blend: 'source-over' });
  });
  const body = paintSprite(res, { w: 6, h: 3.4, ox: 3, oy: 1.7 }, seed + 41, (p, rng) => {
    // wing cases, head to the right; the lantern at the tail, the pronotum's red-orange shield
    p.dab({ x: -2.3, y: 0 }, C.lantern, { rng, variant: 'round', angle: 0, length: 1.1, width: 1.1, opacity: 0.85, blend: 'source-over', layers: 3 });
    p.dab({ x: -2.2, y: 0 }, C.body, { rng, variant: 'leaf', angle: 0, length: 3.6, width: 1.5, opacity: 0.95, pool: 0.4, blend: 'source-over' });
    p.dab({ x: 1.2, y: 0 }, C.pronotum, { rng, variant: 'round', angle: 0, length: 1.0, width: 1.35, opacity: 0.95, blend: 'source-over', layers: 3 });
    p.dab({ x: 1.45, y: 0 }, C.body, { rng, variant: 'round', angle: 0, length: 0.35, width: 0.4, opacity: 0.8, blend: 'source-over' });
    p.dab({ x: 2.0, y: 0 }, C.body, { rng, variant: 'round', angle: 0, length: 0.45, width: 0.55, opacity: 0.9, blend: 'source-over' });
  });
  return { halos, core, body };
}

// ---------------------------------------------------------------------------------------------
// the rhythm

/** Brightness 0..1 through one flash: a slow swell, a longer fade, then dark. */
export function flash(phase: number): number {
  const f = phase - Math.floor(phase);
  if (f < 0.2) return smoothstep(f / 0.2);
  if (f < 0.56) return 1 - smoothstep((f - 0.2) / 0.36);
  return 0;
}

/** How in step the phases are: 0 scattered, 1 all together (the Kuramoto order). */
export function orderOf(phases: readonly number[]): { r: number; mean: number } {
  if (phases.length === 0) return { r: 0, mean: 0 };
  let c = 0;
  let s = 0;
  for (const p of phases) {
    c += Math.cos(p * TAU);
    s += Math.sin(p * TAU);
  }
  c /= phases.length;
  s /= phases.length;
  return { r: Math.hypot(c, s), mean: Math.atan2(s, c) / TAU };
}

/** One step of the phases (in cycles): own rhythm, a pull toward the mean, a little wander. */
export function syncStep(phases: number[], rates: readonly number[], dt: number, coupling: number, wander: number, rng: Rng | null, pace = 1): void {
  const { r, mean } = orderOf(phases);
  const k = coupling / TAU;
  for (let i = 0; i < phases.length; i++) {
    const pull = k * r * Math.sin((mean - phases[i]!) * TAU);
    const noise = rng ? (rng.next() * 2 - 1) * wander * Math.sqrt(dt) * 1.7 / TAU : 0;
    phases[i] = phases[i]! + (rates[i]! * pace + pull) * dt + noise;
  }
}

// ---------------------------------------------------------------------------------------------
// where it flies and rests

type Waters = Pick<FaunaWorld, 'pond' | 'water' | 'view' | 'scene'>;

function inView(q: Pt, w: Pick<FaunaWorld, 'view'>, inset: number): boolean {
  const v = w.view;
  return q.x > v.x + inset && q.x < v.x + v.w - inset && q.y > v.y + inset && q.y < v.y + v.h - inset;
}

/** Inside the foam's keep-out round the falls' foot (scaled by `k`), or in the clip's foam itself. */
export function nearFoam(p: Pt, w: Pick<FaunaWorld, 'pond' | 'water' | 'scene'>, k = 1): boolean {
  const foot = w.scene.falls?.foot;
  const F = FIREFLY_TUNING.foam;
  if (foot && ((p.x - foot.x) / (F.rx * k)) ** 2 + ((p.y - foot.y) / (F.ry * k)) ** 2 < 1) return true;
  const inClip = w.water.clip.some((c) => pointInPolygon(p, c));
  return inClip && !pointInPolygon(p, w.pond.world) && !w.water.moving.some((m) => pointInPolygon(p, m));
}

function waterPolys(w: Pick<FaunaWorld, 'pond' | 'water'>): Pt[][] {
  return [...w.water.moving, w.pond.world].filter((p) => p.length >= 3);
}

/** Over the stream, or over the still pool within `margin` of its edge; clear of the foam, in view. */
export function overFlightWater(q: Pt, w: Waters, slack = 0): boolean {
  if (!inView(q, w, 30 - slack) || nearFoam(q, w)) return false;
  if (w.water.moving.some((m) => m.length >= 3 && insideWithMargin(q, m, 3 - slack))) return true;
  const still = w.pond.world;
  return still.length >= 3 && insideWithMargin(q, still, 4 - slack) && closestOnPolygon(q, still).d < FIREFLY_TUNING.margin + slack;
}

/** A ground point to drift toward (near `near` when given), or null. */
export function flightPoint(w: Waters, rng: Rng, near: Pt | null = null, reach: readonly [number, number] = [25, 110]): Pt | null {
  const moving = w.water.moving.filter((p) => p.length >= 3);
  const still = w.pond.world.length >= 3 ? w.pond.world : null;
  for (let i = 0; i < 40; i++) {
    let q: Pt;
    if (near && i < 30) {
      const a = rng.range(0, TAU);
      const d = rng.range(reach[0], reach[1]);
      q = { x: near.x + Math.cos(a) * d, y: near.y + Math.sin(a) * d * 0.5 };
    } else {
      const poly = moving.length > 0 && (rng.chance(0.55) || !still) ? rng.pick(moving) : still;
      if (!poly) return null;
      q = randomPointInside(poly, rng, 4, 12);
    }
    if (overFlightWater(q, w)) return q;
  }
  return null;
}

export interface RestSpot {
  id: string;
  kind: 'plant' | 'bank' | 'rock';
  /** where the light sits */
  x: number;
  y: number;
  /** the ground under it (perspective) */
  g: number;
}

/** Bank grass along the water, the heads of plants by it and the wet rocks: never the cliff ledges or the foam. */
export function restSpots(w: Pick<FaunaWorld, 'pond' | 'water' | 'view' | 'scene' | 'perches' | 'flowers'>): RestSpot[] {
  const polys = waterPolys(w);
  const wet = (q: Pt) => polys.some((p) => pointInPolygon(q, p));
  const out: RestSpot[] = [];
  polys.forEach((poly, pi) => {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      const len = dist(a, b);
      for (let s = 19; s < len; s += 38) {
        const t = s / len;
        const p = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
        const nx = -(b.y - a.y) / len;
        const ny = (b.x - a.x) / len;
        const o1 = { x: p.x + nx * 7, y: p.y + ny * 7 };
        const o2 = { x: p.x - nx * 7, y: p.y - ny * 7 };
        const o = !wet(o1) ? o1 : !wet(o2) ? o2 : null;
        if (!o || nearFoam(o, w, 1.5) || !inView(o, w, 36)) continue;
        // the pool's back edge is the cliff foot under the falls: no grass there
        if (pi === polys.length - 1 && o.y < w.pond.centre.y - 8) continue;
        out.push({ id: `bank-${pi}-${out.length}`, kind: 'bank', x: o.x, y: o.y - 4, g: o.y });
      }
    }
  });
  const near = (q: Pt) => polys.some((poly) => pointInPolygon(q, poly) || closestOnPolygon(q, poly).d < 90);
  for (const f of w.flowers) {
    const base = { x: f.x, y: f.baseY };
    if (!near(base) || !inView(base, w, 36) || nearFoam(base, w, 1.5)) continue;
    out.push({ id: `plant-${f.plantId}`, kind: 'plant', x: f.x, y: lerp(f.y, f.baseY, 0.55), g: f.baseY });
  }
  for (const p of w.perches) {
    if (p.kind === 'ledge') continue;
    const at = { x: p.x, y: perchY(p, p.x) + p.dome * 0.3 };
    if (!inView(at, w, 36) || nearFoam(at, w, 1.2)) continue;
    out.push({ id: `rock-${p.id}`, kind: 'rock', x: at.x, y: at.y, g: p.depth });
  }
  return out;
}

/** A free rest spot, near ones likelier, grass and plants likelier than rock. */
export function chooseRest(spots: readonly RestSpot[], from: Pt, rng: Rng, taken: readonly Pt[]): RestSpot | null {
  const free = spots.filter((s) => taken.every((t) => dist(t, s) >= 9));
  if (free.length === 0) return null;
  const weights = free.map((s) => (s.kind === 'rock' ? 0.4 : 1) / (1 + (dist(s, from) / 160) ** 2));
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) {
    x -= weights[i]!;
    if (x < 0) return free[i]!;
  }
  return free[free.length - 1]!;
}

// ---------------------------------------------------------------------------------------------

type LightState = 'wait' | 'rest' | 'fly' | 'land' | 'out';

interface Light {
  state: LightState;
  /** ground point under it */
  g: Pt;
  /** height over the ground (world units at perspective 1) */
  h: number;
  vel: Pt;
  target: Pt;
  targetH: number;
  spot: RestSpot | null;
  timer: number;
  until: number;
  /** 0..1: the lantern coming on as it arrives, going dark as it leaves */
  on: number;
  leaveIn: number;
  v: number;
  rot: number;
  speed: number;
  salt: number;
}

export class Firefly extends BaseCreature {
  readonly kind = 'firefly' as const;
  readonly visitor = false;
  override layer: LayerId = 'air';
  readonly lights: Light[] = [];
  /** phases (cycles) and rates (cycles / s), one per light */
  readonly phases: number[] = [];
  private rates: number[] = [];
  private stayLeft: number;
  private rng: Rng;
  private spots: RestSpot[];

  constructor(w: FaunaWorld, rng: Rng, stay: number) {
    super();
    this.rng = rng;
    this.stayLeft = stay;
    this.spots = restSpots(w);
    const T = FIREFLY_TUNING;
    const [lo, hi] = w.mode.reduced ? T.reducedLights : T.lights;
    const n = rng.int(lo, hi);
    const early = w.t < 2;
    const taken: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const resting = rng.chance(T.restStart) && this.spots.length > 0;
      const spot = resting ? chooseRest(this.spots, w.pond.centre, rng, taken) : null;
      const g = spot ? { x: spot.x, y: spot.g } : (flightPoint(w, rng) ?? { ...w.pond.centre });
      const ps = w.perspective(g.y, g.x);
      if (spot) taken.push(spot);
      this.lights.push({
        state: 'wait',
        g,
        h: spot ? (spot.g - spot.y) / ps : rangeOf(rng, T.height),
        vel: { x: 0, y: 0 },
        target: g,
        targetH: rangeOf(rng, T.height),
        spot,
        timer: 0,
        // a swarm there from the start is already lit
        until: early ? 0 : rangeOf(rng, T.arrive),
        on: early ? 1 : 0,
        leaveIn: rangeOf(rng, T.leave),
        v: i % 3,
        rot: rng.range(0, TAU),
        speed: rangeOf(rng, T.speed),
        salt: rng.range(0, 1000),
      });
      this.phases.push(rng.next());
      this.rates.push(1 / rangeOf(rng, T.period));
    }
    this.go('gather');
    this.sync(w);
  }

  update(dt: number, w: FaunaWorld): void {
    this.timer += dt;
    const sdt = dt * w.speed;
    this.stayLeft -= dt;
    if (!this.leaving && (this.stayLeft <= 0 || (!w.mode.night && !this.forced))) this.leave();
    // the rhythm slows with reduced motion too
    syncStep(this.phases, this.rates, dt, FIREFLY_TUNING.coupling, FIREFLY_TUNING.wander, this.rng, w.speed);
    for (const L of this.lights) this.step(L, sdt, w);
    if (this.lights.every((L) => L.state === 'out')) this.done = true;
    else if (!this.leaving && this.lights.every((L) => L.state !== 'wait')) this.state = 'drift';
    this.sync(w);
  }

  override leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.go('leave');
  }

  private step(L: Light, dt: number, w: FaunaWorld): void {
    const T = FIREFLY_TUNING;
    const rng = this.rng;
    L.timer += dt;
    if (L.state === 'out') return;
    if (this.leaving) {
      L.leaveIn -= dt;
      if (L.leaveIn <= 0) {
        // goes dark where it is; one in flight drifts up and away as it fades
        L.on = Math.max(0, L.on - dt / 5);
        if (L.state === 'fly' || L.state === 'land') L.h += dt * 2.5;
        if (L.on <= 0) L.state = 'out';
      }
    } else if (L.on < 1 && L.state !== 'wait') L.on = Math.min(1, L.on + dt / 4);
    switch (L.state) {
      case 'wait':
        if (this.leaving) {
          L.state = 'out';
          return;
        }
        if (L.timer >= L.until) {
          L.state = L.spot ? 'rest' : 'fly';
          L.timer = 0;
          L.until = rangeOf(rng, L.spot ? T.rest : T.fly) * (L.spot ? 0.6 : 1);
        }
        return;
      case 'rest':
        if (L.timer >= L.until && !this.leaving) this.takeOff(L, w);
        return;
      case 'fly':
      case 'land':
        this.fly(L, dt, w);
        return;
    }
  }

  private takeOff(L: Light, w: FaunaWorld): void {
    const T = FIREFLY_TUNING;
    L.spot = null;
    L.state = 'fly';
    L.timer = 0;
    L.until = rangeOf(this.rng, T.fly);
    L.target = flightPoint(w, this.rng, L.g, [20, 70]) ?? flightPoint(w, this.rng) ?? L.g;
    L.targetH = rangeOf(this.rng, T.height);
  }

  private fly(L: Light, dt: number, w: FaunaWorld): void {
    const T = FIREFLY_TUNING;
    const rng = this.rng;
    const to = { x: L.target.x - L.g.x, y: L.target.y - L.g.y };
    const d = Math.hypot(to.x, to.y);
    if (L.state === 'land' && L.spot && d < 1.5) {
      L.g = { x: L.spot.x, y: L.spot.g };
      L.h = (L.spot.g - L.spot.y) / w.perspective(L.spot.g, L.spot.x);
      L.vel = { x: 0, y: 0 };
      L.state = 'rest';
      L.timer = 0;
      L.until = rangeOf(rng, T.rest);
      return;
    }
    if (L.state === 'fly' && !this.leaving) {
      if (d < 6) {
        L.target = flightPoint(w, rng, L.g) ?? L.target;
        L.targetH = rangeOf(rng, T.height);
      }
      if (L.timer >= L.until) {
        const taken = this.lights.filter((o) => o !== L && o.spot).map((o) => o.spot!);
        const spot = chooseRest(this.spots, L.g, rng, taken);
        if (spot) {
          L.spot = spot;
          L.state = 'land';
          L.target = { x: spot.x, y: spot.g };
        } else L.timer = 0;
      }
    }
    // a slow meander: the heading wanders on noise round the way to the target
    const wob = w.noise(w.t * 0.18 + L.salt, L.salt * 0.37) * 1.1;
    const a = Math.atan2(to.y, to.x) + (L.state === 'land' ? wob * 0.3 : wob);
    const sp = L.speed * Math.min(1, d / 18 + 0.25);
    const k = Math.min(1, dt * 0.9);
    L.vel.x += (Math.cos(a) * sp - L.vel.x) * k;
    L.vel.y += (Math.sin(a) * sp * 0.6 - L.vel.y) * k;
    const next = { x: L.g.x + L.vel.x * dt, y: L.g.y + L.vel.y * dt };
    // never out over the foam; out of its water it turns back (landing may cross the bank)
    if (nearFoam(next, w) || (L.state === 'fly' && !overFlightWater(next, w, 14))) {
      L.vel.x *= -0.4;
      L.vel.y *= -0.4;
      L.target = flightPoint(w, rng) ?? L.target;
    } else L.g = next;
    const wantH = L.state === 'land' && L.spot ? (L.spot.g - L.spot.y) / w.perspective(L.spot.g, L.spot.x) : L.targetH;
    const bob = Math.sin(w.t * 0.9 + L.salt) * 1.2;
    L.h += (wantH + (L.state === 'land' ? 0 : bob) - L.h) * Math.min(1, dt * 0.6);
  }

  /** Screen point of a light. */
  where(L: Light, w: Pick<FaunaWorld, 'perspective'>): Pt {
    return { x: L.g.x, y: L.g.y - L.h * w.perspective(L.g.y, L.g.x) };
  }

  /** 0..1: how bright a light is right now (its flash, its lantern coming on or going dark). */
  brightness(i: number, w: Pick<FaunaWorld, 'mode'>): number {
    const L = this.lights[i]!;
    if (L.state === 'wait' || L.state === 'out') return 0;
    const b = flash(this.phases[i]!);
    // resting ones glow a little between flashes; reduced motion breathes gently, never dark
    const floor = w.mode.reduced ? 0.4 : L.state === 'rest' ? 0.1 : 0.04;
    const peak = w.mode.reduced ? 0.8 : L.state === 'rest' ? 0.85 : 1;
    return L.on * (floor + (peak - floor) * b);
  }

  private sync(w: FaunaWorld): void {
    let x = 0;
    let y = 0;
    let n = 0;
    for (const L of this.lights) {
      if (L.state === 'out') continue;
      const p = this.where(L, w);
      x += p.x;
      y += p.y;
      n++;
    }
    if (n > 0) {
      this.x = x / n;
      this.y = y / n;
    }
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'air') return;
    const parts = w.art.get(`firefly:${this.id % 2}`, (res) => paintFirefly(res, 2500 + (this.id % 2) * 11));
    // the body is a speck until the view comes close
    const bodyA = clamp((w.art.res - 2.6) / 1.6, 0, 1);
    for (let i = 0; i < this.lights.length; i++) {
      const L = this.lights[i]!;
      const b = this.brightness(i, w);
      if (L.state === 'wait' || L.state === 'out') continue;
      const p = this.where(L, w);
      const ps = w.perspective(L.g.y, L.g.x);
      if (bodyA > 0.01 && L.on > 0.01) {
        const ang = L.state === 'rest' ? L.rot : Math.atan2(L.vel.y, L.vel.x);
        this.blit(ctx, parts.body, p.x, p.y, ang, ps * 0.9, bodyA * L.on * 0.9);
      }
      if (b < 0.01) continue;
      // the halo spreads a little as the light swells, like a wet bloom
      this.blit(ctx, parts.halos[L.v]!, p.x, p.y, L.rot, ps * (0.72 + 0.32 * b), b * 0.9);
      this.blit(ctx, parts.core, p.x, p.y, -L.rot, ps * (0.8 + 0.25 * b), Math.min(1, b * 1.25));
    }
  }

  private blit(ctx: Ctx, s: Sprite, x: number, y: number, rot: number, k: number, alpha: number): void {
    if (alpha <= 0.004) return;
    const c = Math.cos(rot) * k;
    const sn = Math.sin(rot) * k;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha);
    ctx.transform(c, sn, -sn, c, x, y);
    ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  }
}

const firefly: CreatureDef = {
  kind: 'firefly',
  title: 'Genji fireflies',
  role: 'drifter',
  // one swarm a night: it comes after dark, stays the evening, goes dark at daybreak
  visit: { gap: [300, 900], first: [20, 80], stay: [1500, 3000], group: [1, 1], max: 1, diurnal: false, nocturnal: true, visitor: false },
  needs: (w) => waterPolys(w).length > 0,
  spawn(w, s) {
    const out: Firefly[] = [];
    for (let i = 0; i < s.count; i++) {
      const rng = w.rng.fork(`firefly:${s.seed}:${w.t.toFixed(3)}:${s.index + i}:${w.creatures.length}`);
      out.push(new Firefly(w, rng, s.stay || 1800));
    }
    return out;
  },
  sheet: {
    w: 520,
    h: 130,
    make(res, seed) {
      const a = paintFirefly(res, seed);
      return [...a.halos, a.core, a.body];
    },
  },
  show: { stage: 'falls', spec: { w: 420, h: 266 }, w: 570, h: 361, order: 24 },
};
export default firefly;
