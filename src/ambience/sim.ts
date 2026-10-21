/**
 * Particle simulation for the ambience — pure data, no canvas. Rain strokes (3 depths),
 * ripple rings and sun glints on the pond, photosynthesis motes. Spawns are Poisson processes
 * driven by the envelope levels; everything advances on *ambience time* (dt × motion), so a
 * pause eases every particle to stillness. Drawing lives in draw.ts.
 */
import type { Rng } from '../core/rng';
import { bounds, pointInPolygon, type Rect } from '../paint/geometry';
import type { Pt } from '../render/viewport';
import type { Levels } from './envelope';
import { MOTE, moteRate, pickEmitter, type Emitter } from './motes';
import type { WindFn } from './wind';

export interface RainLayer {
  /** strokes alive at full level, per 1600×1000 world area */
  count: number;
  /** fall speed (world units / s) */
  speed: number;
  /** stroke length range (world units) */
  len: readonly [number, number];
  /** lifetime range (s) — a stroke fades in and out within it */
  life: readonly [number, number];
}

/** Far → near. Near strokes are longer and faster (parallax), all faint. */
export const RAIN = {
  layers: [
    { count: 70, speed: 300, len: [7, 12], life: [0.35, 0.6] },
    { count: 42, speed: 470, len: [13, 21], life: [0.3, 0.5] },
    { count: 16, speed: 720, len: [24, 38], life: [0.25, 0.4] },
  ] as readonly RainLayer[],
  /** base slant from vertical (rad, + = falling toward +x) */
  slant: 0.2,
  /** extra slant per unit of wind sway */
  windSlant: 0.14,
} as const;

export const RIPPLE = { rate: 2.4, life: [1.8, 2.9] as const, size: [12, 30] as const, max: 16 } as const;
export const GLINT = { rate: 0.8, life: [1.3, 2.4] as const, len: [5, 14] as const, max: 5 } as const;

export interface RainDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  layer: number;
  variant: number;
  len: number;
  age: number;
  life: number;
}
export interface Ripple {
  x: number;
  y: number;
  size: number;
  variant: number;
  age: number;
  life: number;
}
export interface Glint {
  x: number;
  y: number;
  len: number;
  variant: number;
  age: number;
  life: number;
}
export interface Mote {
  x: number;
  y: number;
  rise: number;
  size: number;
  /** 0 = pale gold … 1 = pale green */
  hue: number;
  phase: number;
  age: number;
  life: number;
}

export interface SimWorld {
  pond: readonly Pt[];
  /** world rectangle particles are spawned in (the visible part of the world) */
  area: Rect;
}

export interface Sim {
  rng: Rng;
  world: SimWorld;
  pondBox: Rect;
  rain: RainDrop[];
  ripples: Ripple[];
  glints: Glint[];
  motes: Mote[];
  /** seconds until the next spawn per stream (Infinity = idle) */
  timers: Record<string, number>;
  /** ambience time (s) — advances with dt × motion */
  t: number;
}

export interface SimInputs {
  levels: Levels;
  wind: WindFn;
  emitters: readonly Emitter[];
}

export const SPRITE_VARIANTS = 6;

const WORLD_AREA = 1600 * 1000;

export function createSim(rng: Rng, world: SimWorld): Sim {
  return { rng, world, pondBox: bounds([...world.pond]), rain: [], ripples: [], glints: [], motes: [], timers: {}, t: 0 };
}

export function setSimArea(sim: Sim, area: Rect): void {
  sim.world = { ...sim.world, area };
}

const range = (rng: Rng, r: readonly [number, number]) => rng.range(r[0], r[1]);

/** Poisson spawning: call `spawn` for every event in the next `dt` seconds at `rate`/s. */
function poisson(sim: Sim, key: string, rate: number, dt: number, spawn: (offset: number) => void): void {
  if (!(rate > 0)) {
    sim.timers[key] = Infinity;
    return;
  }
  let timer = sim.timers[key] ?? Infinity;
  if (!Number.isFinite(timer)) timer = -Math.log(1 - sim.rng.next()) / rate;
  let elapsed = 0;
  while (timer <= dt - elapsed) {
    elapsed += timer;
    spawn(dt - elapsed);
    timer = -Math.log(1 - sim.rng.next()) / rate;
  }
  sim.timers[key] = timer - (dt - elapsed);
}

function randomPondPoint(sim: Sim, topBias = 0): Pt | null {
  const b = sim.pondBox;
  for (let i = 0; i < 12; i++) {
    const v = sim.rng.next();
    const p = { x: b.x + sim.rng.next() * b.w, y: b.y + (topBias > 0 ? v ** (1 + topBias) : v) * b.h };
    if (pointInPolygon(p, sim.world.pond)) return p;
  }
  return null;
}

/** Strokes of one layer alive at full level for the current spawn area. */
export function rainTarget(layer: RainLayer, area: Rect): number {
  return layer.count * Math.max(0.2, (area.w * area.h) / WORLD_AREA);
}

/** Advance by `dt` real seconds; the envelope's `motion` scales time for every particle. */
export function stepSim(sim: Sim, dt: number, input: SimInputs): void {
  const { levels } = input;
  const d = dt * Math.max(0, levels.motion);
  if (!(d > 0)) return;
  sim.t += d;
  const rng = sim.rng;
  const area = sim.world.area;

  // age & move
  for (const r of sim.rain) {
    r.age += d;
    r.x += r.vx * d;
    r.y += r.vy * d;
  }
  sim.rain = sim.rain.filter((r) => r.age < r.life);
  for (const p of sim.ripples) p.age += d;
  sim.ripples = sim.ripples.filter((p) => p.age < p.life);
  for (const g of sim.glints) g.age += d;
  sim.glints = sim.glints.filter((g) => g.age < g.life);
  for (const m of sim.motes) {
    m.age += d;
    const w = input.wind(sim.t, m.x, m.y, levels.boost);
    m.y -= m.rise * d;
    m.x += (w.sway * MOTE.windDrift + Math.sin(m.phase + m.age * 0.6) * 2.2) * d;
  }
  sim.motes = sim.motes.filter((m) => m.age < m.life);

  // rain: keep each layer near its target count (rate = target / mean life)
  RAIN.layers.forEach((L, li) => {
    const meanLife = (L.life[0] + L.life[1]) / 2;
    const rate = (rainTarget(L, area) * levels.rain) / meanLife;
    poisson(sim, `rain${li}`, rate, d, (off) => {
      const len = range(rng, L.len);
      const x = area.x - 40 + rng.next() * (area.w + 80);
      const y = area.y - 30 + rng.next() * (area.h + 30);
      const sway = input.wind(sim.t, x, y, levels.boost).sway;
      const a = RAIN.slant + RAIN.windSlant * sway;
      const speed = L.speed * rng.range(0.85, 1.15);
      const drop: RainDrop = {
        x,
        y,
        vx: Math.sin(a) * speed,
        vy: Math.cos(a) * speed,
        layer: li,
        variant: rng.int(0, SPRITE_VARIANTS - 1),
        len,
        age: off,
        life: range(rng, L.life),
      };
      drop.x += drop.vx * off;
      drop.y += drop.vy * off;
      sim.rain.push(drop);
    });
  });

  // ripple rings on the pond while it rains
  poisson(sim, 'ripple', RIPPLE.rate * levels.rain, d, (off) => {
    if (sim.ripples.length >= RIPPLE.max) return;
    const p = randomPondPoint(sim);
    if (!p) return;
    sim.ripples.push({ ...p, size: range(rng, RIPPLE.size), variant: rng.int(0, SPRITE_VARIANTS - 1), age: off, life: range(rng, RIPPLE.life) });
  });

  // occasional glints in sunshine, mostly toward the far (upper) water
  poisson(sim, 'glint', GLINT.rate * levels.sun, d, (off) => {
    if (sim.glints.length >= GLINT.max) return;
    const p = randomPondPoint(sim, 0.8);
    if (!p) return;
    sim.glints.push({ ...p, len: range(rng, GLINT.len), variant: rng.int(0, SPRITE_VARIANTS - 1), age: off, life: range(rng, GLINT.life) });
  });

  // motes from the plants
  poisson(sim, 'mote', moteRate(input.emitters, levels.motes), d, (off) => {
    if (sim.motes.length >= MOTE.max) return;
    const e = pickEmitter(input.emitters, rng.next());
    if (!e) return;
    sim.motes.push({
      x: e.x + rng.range(-0.5, 0.5) * e.w,
      y: e.y - rng.range(0.3, 0.95) * e.h,
      rise: range(rng, MOTE.rise),
      size: range(rng, MOTE.size),
      hue: rng.next(),
      phase: rng.range(0, Math.PI * 2),
      age: off,
      life: range(rng, MOTE.life),
    });
  });
}

/**
 * Simulate `seconds` with full motion so particles are at their steady state (first frame,
 * dev previews, reduced-motion still frames). Levels are used as given except motion.
 */
export function warmSim(sim: Sim, seconds: number, input: SimInputs, step = 1 / 20): void {
  const levels = { ...input.levels, motion: 1 };
  for (let s = 0; s < seconds; s += step) stepSim(sim, step, { ...input, levels });
}

/** Fade-in/out of a particle over its life (0..1): quick in, quick out. */
export function lifeAlpha(age: number, life: number, inFrac = 0.2, outFrac = 0.3): number {
  if (!(life > 0)) return 0;
  const u = age / life;
  if (u <= 0 || u >= 1) return 0;
  const a = Math.min(1, u / inFrac);
  const b = Math.min(1, (1 - u) / outFrac);
  const k = Math.min(a, b);
  return k * k * (3 - 2 * k);
}
