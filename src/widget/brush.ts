import type { Rng } from '../core/rng';

/**
 * A tiny, self-contained watercolour toolkit for the widget's small canvases (sprout, paper,
 * favicon). Deliberately independent of `src/paint` so the widget can ship on its own; it can
 * be swapped for the paint engine later. Every jitter comes from a seeded Rng, so a redraw with
 * the same seed is pixel-identical (no flicker when the widget repaints every second).
 */

export type Ctx = CanvasRenderingContext2D;
export interface P {
  x: number;
  y: number;
}

export const PIGMENT = {
  paper: '#f3ecd9',
  paperDeep: '#e9dec3',
  ink: '#4a443c',
  sage: '#a9b386',
  sap: '#8d9a6c',
  olive: '#6f7a52',
  celadon: '#a9c3bb',
  stone: '#9b978d',
  stoneWarm: '#a39a8b',
  sakura: '#e8a7a9',
  sakuraPale: '#f1c6c3',
  petalWhite: '#faf6ee',
  vermilion: '#d0694a',
  gold: '#d9b36c',
} as const;

export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

/** Smooth 1-D noise in about [-1, 1]: three seeded sines. */
export function wobble(rng: Rng): (t: number) => number {
  const f = [rng.range(1.1, 2.3), rng.range(2.9, 4.7), rng.range(6.1, 9.3)];
  const ph = [rng.range(0, 6.283), rng.range(0, 6.283), rng.range(0, 6.283)];
  return (t) => (Math.sin(t * f[0]! + ph[0]!) * 0.55 + Math.sin(t * f[1]! + ph[1]!) * 0.3 + Math.sin(t * f[2]! + ph[2]!) * 0.15);
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 before a, 1 after b, smooth in between. */
export const smooth = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a || 1e-9));
  return t * t * (3 - 2 * t);
};

export function cubic(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function tracePath(ctx: Ctx, pts: readonly P[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/**
 * A wet-edge wash: several translucent, slightly displaced copies of the shape (glazing), then a
 * thin darker rim where pigment pools. `lost` (0..1) lets the rim fade out on one side.
 */
export function wash(
  ctx: Ctx,
  outline: readonly P[],
  rng: Rng,
  o: { color: string; alpha: number; layers?: number; jitter?: number; rim?: number; rimColor?: string; lost?: number },
): void {
  const layers = o.layers ?? 4;
  const jitter = o.jitter ?? 1;
  for (let k = 0; k < layers; k++) {
    const dx = rng.range(-jitter, jitter) * 0.6;
    const dy = rng.range(-jitter, jitter) * 0.6;
    const shrink = 1 - k * 0.03;
    const c = centroid(outline);
    const pts = outline.map((p) => ({
      x: c.x + (p.x - c.x) * shrink + dx + rng.range(-jitter, jitter),
      y: c.y + (p.y - c.y) * shrink + dy + rng.range(-jitter, jitter),
    }));
    ctx.fillStyle = rgba(o.color, o.alpha);
    tracePath(ctx, pts);
    ctx.fill();
  }
  const rim = o.rim ?? 0;
  if (rim > 0) {
    const lost = o.lost ?? 0;
    const n = outline.length;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = outline[i]!;
      const b = outline[(i + 1) % n]!;
      // the rim fades over the "lost" part of the outline (the second half by index)
      const fade = lost > 0 ? 1 - lost * smooth(0.45, 0.85, i / n) : 1;
      if (fade <= 0.02) continue;
      ctx.strokeStyle = rgba(o.rimColor ?? o.color, rim * fade);
      ctx.lineWidth = Math.max(0.35, jitter * 0.55 * rng.range(0.6, 1.2));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

export function centroid(pts: readonly P[]): P {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/**
 * A tapered brush stroke along `pts`, filled as one outline so it never shows segment joints.
 * `width(t)` is the full width at t ∈ [0,1]; `edge` jitters the outline (organic, not vector).
 */
export function brushStroke(
  ctx: Ctx,
  pts: readonly P[],
  rng: Rng,
  o: { width: (t: number) => number; color: string; alpha: number; edge?: number },
): void {
  if (pts.length < 2) return;
  const left: P[] = [];
  const right: P[] = [];
  const edge = o.edge ?? 0.15;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const w = Math.max(0, o.width(i / (n - 1))) / 2;
    const jl = 1 + rng.range(-edge, edge);
    const jr = 1 + rng.range(-edge, edge);
    left.push({ x: p.x - ty * w * jl, y: p.y + tx * w * jl });
    right.push({ x: p.x + ty * w * jr, y: p.y - tx * w * jr });
  }
  ctx.fillStyle = rgba(o.color, o.alpha);
  tracePath(ctx, [...left, ...right.reverse()]);
  ctx.fill();
}

/**
 * A thin sumi line: tapered, slightly wobbly, sometimes broken (`breaks` = chance per segment
 * of lifting the brush).
 */
export function inkLine(
  ctx: Ctx,
  pts: readonly P[],
  rng: Rng,
  o: { width: (t: number) => number; alpha?: number; color?: string; breaks?: number },
): void {
  const breaks = o.breaks ?? 0;
  let run: P[] = [];
  let startT = 0;
  const flush = (endT: number) => {
    if (run.length >= 2) {
      const t0 = startT;
      brushStroke(ctx, run, rng, {
        width: (t) => o.width(lerp(t0, endT, t)),
        color: o.color ?? PIGMENT.ink,
        alpha: o.alpha ?? 0.85,
        edge: 0.2,
      });
    }
    run = [];
  };
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1 || 1);
    if (run.length === 0) startT = t;
    run.push(pts[i]!);
    if (breaks > 0 && i > 1 && i < pts.length - 2 && rng.chance(breaks)) {
      flush(t);
      i++; // skip one segment: the lifted brush
    }
  }
  flush(1);
}

/** Pointed leaf / petal outline in local coordinates: base at (0,0), tip at (len, 0). */
export function leafOutline(len: number, width: number, rng: Rng, o: { asym?: number; tipBend?: number; round?: number } = {}): P[] {
  const asym = o.asym ?? rng.range(-0.18, 0.18);
  const bend = o.tipBend ?? rng.range(-0.12, 0.12);
  const round = o.round ?? 0.8;
  const n = 11;
  const top: P[] = [];
  const bot: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const prof = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), round) * width * 0.5;
    const curve = bend * len * t * t;
    const j = 1 + rng.range(-0.06, 0.06);
    top.push({ x: t * len, y: curve - prof * (1 + asym) * j });
    bot.push({ x: t * len, y: curve + prof * (1 - asym) * j });
  }
  return [...top, ...bot.reverse().slice(1, -1)];
}

export function transform(pts: readonly P[], at: P, angle: number, scale = 1): P[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return pts.map((p) => ({ x: at.x + (p.x * c - p.y * s) * scale, y: at.y + (p.x * s + p.y * c) * scale }));
}
