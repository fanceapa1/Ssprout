import { createRng, type Rng } from '../core/rng';
import { brushStrokePath } from './brush-path';
import { deckledRoundPath, svgUrl } from './paper';

/**
 * The calendar's painted pieces (ADR 0175), as SVG paths so the page (CSS backgrounds) and the
 * studio (Path2D) draw the same shapes: a soft wash for a session block (a deckled blot with a
 * pooled rim, in the plant's colour), a broken ink outline for a planned block, small pigment dabs
 * for the month, a brush ring for today, brush chevrons. Seeded, so the page is stable.
 */

const BOX = 1000;
const INK = '#3b352e';

/**
 * A blot in a `w × h` box (about pixels, so the edge wanders the same on a long bar and a small
 * square): a rectangle with softened corners whose sides drift a little, smoothed so they read as
 * a brush's edge rather than a tear.
 */
export function washPath(rng: Rng, w: number, h: number, inset = 2.5, amp = 1.6): string {
  const lo = { x: inset, y: inset };
  const hi = { x: w - inset, y: h - inset };
  const r = Math.min(w, h) * 0.14;
  const side = (len: number) => {
    const steps = Math.max(4, Math.min(48, Math.round(len / 14)));
    const out: number[] = [];
    let v = 0;
    for (let i = 0; i <= steps; i++) {
      v = v * 0.72 + rng.range(-amp, amp);
      out.push(v);
    }
    return out;
  };
  const pts: Array<[number, number]> = [];
  const run = (n: number[], f: (u: number, d: number) => [number, number]) => {
    const steps = n.length - 1;
    for (let i = 0; i < steps; i++) pts.push(f(i / steps, n[i]! * (Math.sin((Math.PI * i) / steps) * 0.7 + 0.3)));
  };
  const W = hi.x - lo.x;
  const H = hi.y - lo.y;
  run(side(W), (u, d) => [lo.x + r + (W - 2 * r) * u, lo.y + d]);
  pts.push([hi.x - r * 0.3, lo.y + r * 0.3]);
  run(side(H), (u, d) => [hi.x + d, lo.y + r + (H - 2 * r) * u]);
  pts.push([hi.x - r * 0.3, hi.y - r * 0.3]);
  run(side(W), (u, d) => [hi.x - r - (W - 2 * r) * u, hi.y + d]);
  pts.push([lo.x + r * 0.3, hi.y - r * 0.3]);
  run(side(H), (u, d) => [lo.x + d, hi.y - r - (H - 2 * r) * u]);
  pts.push([lo.x + r * 0.3, lo.y + r * 0.3]);
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
}

/** Sizes are bucketed so a handful of washes serve every block. */
export function sizeBucket(px: number): number {
  const steps = [24, 36, 56, 84, 128, 192, 288, 432, 648, 972];
  return steps.find((s) => px <= s * 1.2) ?? 972;
}

/** `#rrggbb` → `[r, g, b]` (0–255); bad input → sage. */
export function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [139, 156, 90];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A plant's colour as a wash pigment: very pale blooms (white anemone, cream camellia) would vanish
 * on the paper, so they are pulled toward a cool grey-green; everything keeps its hue.
 */
export function washTone(hex: string): [number, number, number] {
  const [r, g, b] = hexRgb(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum <= 0.72) return [r, g, b];
  const k = Math.min(0.6, (lum - 0.72) * 2.2);
  const to = [124, 138, 128];
  return [Math.round(r + (to[0]! - r) * k), Math.round(g + (to[1]! - g) * k), Math.round(b + (to[2]! - b) * k)];
}

const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export interface WashStyle {
  /** opacity of the body of the wash */
  body: number;
  /** opacity of the pooled rim */
  rim: number;
}

export const WASH: Readonly<Record<'bloom' | 'growing' | 'faint', WashStyle>> = {
  bloom: { body: 0.22, rim: 0.4 },
  growing: { body: 0.15, rim: 0.34 },
  faint: { body: 0.07, rim: 0.16 },
};

/** A watercolour wash as an SVG document: body, a lighter heart (the paper breathing through), a pooled rim. */
export function washSvg(seed: number | string, hex: string, style: WashStyle = WASH.bloom, w = 200, h = 60): string {
  const rng = createRng(seed);
  const d = washPath(rng, w, h);
  const m = Math.min(w, h);
  const heart = washPath(rng, w - m * 0.5, h - m * 0.5, 0, 2.4);
  const c = rgb(washTone(hex));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
    `<path d="${d}" fill="${c}" fill-opacity="${style.body}"/>` +
    `<path d="${heart}" transform="translate(${(m * 0.25).toFixed(1)} ${(m * 0.25).toFixed(1)})" fill="#f6f0df" fill-opacity="${(style.body * 0.5).toFixed(3)}"/>` +
    `<path d="${d}" fill="none" stroke="${c}" stroke-opacity="${style.rim}" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `</svg>`
  );
}

/** A planned block: paper with a thin ink outline that breaks in places (not yet painted). */
export function planSvg(seed: number | string, opacity = 0.42, w = 200, h = 60): string {
  const rng = createRng(seed);
  const d = washPath(rng, w, h, 1.5, 0.9);
  const a = rng.int(700, 1300);
  const b = rng.int(40, 90);
  const c = rng.int(900, 1500);
  const e = rng.int(30, 70);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
    `<path d="${d}" fill="#f6f0df" fill-opacity="0.72" stroke="${INK}" stroke-opacity="${opacity}" stroke-width="1.1" stroke-linejoin="round" ` +
    `vector-effect="non-scaling-stroke" pathLength="4000" stroke-dasharray="${a} ${b} ${c} ${e} ${4000 - a - b - c - e} 0"/>` +
    `</svg>`
  );
}

/** A brush ring (today in the month and week heads): a torn round drawn as a broken ink line. */
export function ringSvg(seed: number | string, color = '#ad452d', opacity = 0.7): string {
  const d = deckledRoundPath(createRng(seed), 48, 0.05);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" preserveAspectRatio="none">` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.6" vector-effect="non-scaling-stroke" ` +
    `stroke-linecap="round" pathLength="4000" stroke-dasharray="3700 300"/></svg>`
  );
}

/** A short horizontal brush stroke (the chosen view's underline), `w × 8`. */
export function underlineSvg(seed: number | string, w = 64): string {
  const d = brushStrokePath(seed, { length: w, width: 2.4, wobble: 0.4, steps: 18 });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 8" width="${w}" height="8">` +
    `<path d="${d}" transform="translate(0 6.5) rotate(-90)" fill="#ad452d" fill-opacity="0.78"/></svg>`
  );
}

/** Brush chevrons for prev / next, 24 × 24 stroke paths. */
export const CHEVRON = {
  prev: 'M14.6 6.4c-2 1.8-3.9 3.7-5.6 5.7 1.8 1.9 3.7 3.8 5.6 5.6',
  next: 'M9.4 6.4c2 1.8 3.9 3.7 5.6 5.7-1.8 1.9-3.7 3.8-5.6 5.6',
  plus: 'M12 6.2c.1 3.9 0 7.8-.1 11.6M6.3 12.1c3.9-.1 7.7-.1 11.5 0',
} as const;

export const chevronSvg = (d: string): string =>
  `<svg class="ink-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------------------------------------------------------------------------------------------
// The same shapes on a canvas (the studio draws the calendar with them)
// ---------------------------------------------------------------------------------------------

/** Paint a block's wash at `x, y` (`w × h` px), exactly as `washSvg` draws it. */
export function paintWash(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: string, hex: string, style: WashStyle = WASH.bloom): void {
  const rng = createRng(seed);
  const d = new Path2D(washPath(rng, w, h));
  const m = Math.min(w, h);
  const heart = new Path2D(washPath(rng, w - m * 0.5, h - m * 0.5, 0, 2.4));
  const [r, g, b] = washTone(hex);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(${r},${g},${b},${style.body})`;
  ctx.fill(d);
  ctx.save();
  ctx.translate(m * 0.25, m * 0.25);
  ctx.fillStyle = `rgba(246,240,223,${style.body * 0.5})`;
  ctx.fill(heart);
  ctx.restore();
  ctx.strokeStyle = `rgba(${r},${g},${b},${style.rim})`;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke(d);
  ctx.restore();
}

/** Paint a planned block's paper and broken ink outline, as `planSvg` draws it. */
export function paintPlan(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: string, opacity = 0.42): void {
  const rng = createRng(seed);
  const d = new Path2D(washPath(rng, w, h, 1.5, 0.9));
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(246,240,223,0.72)';
  ctx.fill(d);
  ctx.strokeStyle = `rgba(59,53,46,${opacity})`;
  ctx.lineWidth = 1.1;
  ctx.setLineDash([Math.max(8, (w + h) * 0.6), 6, Math.max(8, (w + h) * 0.8), 4]);
  ctx.stroke(d);
  ctx.restore();
}

/** CSS custom properties with a few seeded variants, installed once (like paper.ts). */
export function installCalendarArt(doc: Document = document): void {
  if (doc.getElementById('ui-calendar-art')) return;
  const vars: string[] = [];
  vars.push(`--cal-ring: ${svgUrl(ringSvg('today'))};`);
  vars.push(`--cal-ring-ink: ${svgUrl(ringSvg('chosen', INK, 0.5))};`);
  vars.push(`--cal-underline: ${svgUrl(underlineSvg('view'))};`);
  const style = doc.createElement('style');
  style.id = 'ui-calendar-art';
  style.textContent = `:root{${vars.join('')}}`;
  doc.head.appendChild(style);
}

export type WashKind = keyof typeof WASH | 'plan' | 'ghost';

/**
 * A block's painted background as a CSS value, sized near its on-screen size (`w × h` px) and
 * cached per colour × variant × kind × size bucket.
 */
const washCache = new Map<string, string>();
export function washBackground(hex: string, variant: number, kind: WashKind, w: number, h: number): string {
  const bw = sizeBucket(w);
  const bh = sizeBucket(h);
  const v = variant % 4;
  const k = `${kind === 'plan' || kind === 'ghost' ? '' : hex}|${v}|${kind}|${bw}x${bh}`;
  let out = washCache.get(k);
  if (!out) {
    const seed = `wash-${v}-${kind}-${bw}x${bh}`;
    out = svgUrl(kind === 'plan' || kind === 'ghost' ? planSvg(seed, kind === 'ghost' ? 0.22 : 0.42, bw, bh) : washSvg(seed, hex, WASH[kind], bw, bh));
    washCache.set(k, out);
  }
  return out;
}
