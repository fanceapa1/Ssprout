/**
 * Pre-painted textures for the ambience, built once per scene (never per frame): light shafts,
 * rain strokes, ripple rings, glints, motes, mist bands, the lantern flame. Each is computed per
 * pixel from seeded noise so edges are broken and uneven — washes and strokes, not vector
 * shapes. Browser only (canvas); the maths is in small pure helpers.
 */
import { createRng, type Rng } from '../core/rng';
import { makeCanvas, type AnyCanvas } from '../paint/canvas';
import { createSimplex2D, createValueNoise2D, fbm, type Noise2D } from '../paint/noise';
import { WORLD_H, WORLD_W } from '../render/viewport';
import type { Rgb } from './timeofday';
import { RAIN, SPRITE_VARIANTS } from './sim';

export const COLOURS = {
  /** warm cream light (screen) */
  shaft: [255, 244, 222] as Rgb,
  /** ink-wash rain, grey-blue (multiply) */
  rain: [92, 108, 122] as Rgb,
  /** ripple line: deep celadon, and the lifted pale line beside it */
  rippleDark: [88, 124, 122] as Rgb,
  rippleLight: [250, 248, 238] as Rgb,
  glint: [255, 251, 238] as Rgb,
  moteGold: [234, 206, 124] as Rgb,
  moteGreen: [214, 228, 150] as Rgb,
  mist: [246, 244, 238] as Rgb,
  flame: [246, 222, 170] as Rgb,
} as const;

export const SHAFT_SCALE = 0.2;
export const MIST_SCALE = 0.3;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Paint a canvas per pixel: `fn` returns alpha 0..1 and may set the colour via `rgb`. */
function pixels(w: number, h: number, colour: Rgb, fn: (x: number, y: number, rgb: number[]) => number): AnyCanvas {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const d = img.data;
  const rgb = [0, 0, 0];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      rgb[0] = colour[0];
      rgb[1] = colour[1];
      rgb[2] = colour[2];
      const a = fn(x, y, rgb);
      const i = (y * canvas.width + x) * 4;
      d[i] = rgb[0];
      d[i + 1] = rgb[1];
      d[i + 2] = rgb[2];
      d[i + 3] = clamp01(a) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface ShaftDef {
  x0: number;
  y0: number;
  /** angle from vertical (rad, + leans toward +x) */
  angle: number;
  width: number;
  length: number;
}

/** Four shafts falling from the upper left, split into two groups that breathe in turn. */
export function shaftLayout(rng: Rng): ShaftDef[] {
  const xs = [80, 420, 760, 1080];
  return xs.map((x, i) => ({
    x0: x + rng.range(-60, 60),
    y0: -120,
    angle: 0.5 + rng.range(-0.05, 0.05),
    width: [150, 90, 130, 70][i]! * rng.range(0.85, 1.15),
    length: rng.range(950, 1250),
  }));
}

function shaftCanvas(defs: ShaftDef[], noise: Noise2D, streak: Noise2D): AnyCanvas {
  const w = Math.ceil(WORLD_W * SHAFT_SCALE);
  const h = Math.ceil(WORLD_H * SHAFT_SCALE);
  return pixels(w, h, COLOURS.shaft, (px, py) => {
    const wx = (px + 0.5) / SHAFT_SCALE;
    const wy = (py + 0.5) / SHAFT_SCALE;
    let keep = 1;
    defs.forEach((s, i) => {
      const sa = Math.sin(s.angle);
      const ca = Math.cos(s.angle);
      const dx = wx - s.x0;
      const dy = wy - s.y0;
      const along = dx * sa + dy * ca;
      const across = dx * ca - dy * sa;
      if (along <= 0 || along >= s.length) return;
      const half = (s.width / 2) * (1 + 0.35 * noise(along / 140, i * 7.1)) * (0.75 + 0.5 * (along / s.length));
      const k = Math.abs(across) / half;
      if (k >= 1.2) return;
      const side = 1 - smoothstep(0.3, 1.05 + 0.15 * noise(along / 40, 3 + i), k);
      const len = along / s.length;
      const lengthwise = smoothstep(0, 0.18, len) * (1 - smoothstep(0.4, 0.95, len));
      const streaks = 0.82 + 0.18 * streak(across / 34, along / 300 + i * 3);
      keep *= 1 - side * lengthwise * streaks;
    });
    return 1 - keep;
  });
}

/** Rain stroke sprite (vertical, head at the bottom) — tapered, faintly broken ink wash. */
function rainSprite(rng: Rng, layer: number): AnyCanvas {
  const W = 8;
  const H = 64;
  const n = createSimplex2D(rng);
  const bend = rng.range(-0.6, 0.6);
  const core = [0.55, 0.65, 0.8][layer] ?? 0.65;
  return pixels(W, H, COLOURS.rain, (x, y) => {
    const t = (y + 0.5) / H;
    const cx = W / 2 + bend * Math.sin(t * Math.PI);
    const thick = core * Math.sin(Math.PI * t) ** 0.6 + 0.15;
    const d = Math.abs(x + 0.5 - cx);
    const body = 1 - smoothstep(thick * 0.6, thick + 0.7, d);
    const along = 0.35 + 0.65 * t ** 1.4; // the tail fades upward
    const breaks = 0.7 + 0.3 * smoothstep(-0.4, 0.4, n(0, t * 5));
    return body * along * breaks;
  });
}

/** Ripple ring: a broken deep line with a pale lifted line inside, sometimes a faint inner ring. */
function rippleSprite(rng: Rng): AnyCanvas {
  const S = 128;
  const R = 58;
  const n = createSimplex2D(rng);
  const inner = rng.chance(0.6);
  const [dr, dg, db] = COLOURS.rippleDark;
  const [lr, lg, lb] = COLOURS.rippleLight;
  return pixels(S, S, COLOURS.rippleDark, (x, y, rgb) => {
    const dx = x + 0.5 - S / 2;
    const dy = y + 0.5 - S / 2;
    const ang = Math.atan2(dy, dx);
    const wob = 1 + 0.03 * n(Math.cos(ang) * 2, Math.sin(ang) * 2);
    const d = Math.hypot(dx, dy) / (R * wob);
    const broken = smoothstep(-0.35, 0.25, n(Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5));
    const front = 0.55 + 0.45 * Math.max(0, Math.sin(ang)); // nearer half reads stronger
    const dark = Math.exp(-(((d - 1) / 0.035) ** 2)) * broken * front;
    const light = Math.exp(-(((d - 0.93) / 0.03) ** 2)) * broken * 0.9;
    const second = inner ? Math.exp(-(((d - 0.62) / 0.03) ** 2)) * 0.45 * broken * front : 0;
    const a = Math.min(1, dark + light + second);
    if (a <= 0) return 0;
    const lw = light / (dark + light + second + 1e-6);
    rgb[0] = dr + (lr - dr) * lw;
    rgb[1] = dg + (lg - dg) * lw;
    rgb[2] = db + (lb - db) * lw;
    return a;
  });
}

/** A horizontal tapered dash of lifted paper. */
function glintSprite(rng: Rng): AnyCanvas {
  const W = 48;
  const H = 8;
  const skew = rng.range(0.35, 0.65);
  return pixels(W, H, COLOURS.glint, (x, y) => {
    const t = (x + 0.5) / W;
    const taper = t < skew ? (t / skew) ** 0.8 : ((1 - t) / (1 - skew)) ** 1.2;
    const dy = (y + 0.5 - H / 2) / (1.4 * taper + 0.3);
    return taper * Math.exp(-dy * dy);
  });
}

/** A soft, slightly irregular speck. */
function moteSprite(rng: Rng, colour: Rgb): AnyCanvas {
  const S = 16;
  const n = createSimplex2D(rng);
  return pixels(S, S, colour, (x, y) => {
    const dx = x + 0.5 - S / 2;
    const dy = y + 0.5 - S / 2;
    const a = Math.atan2(dy, dx);
    const r = (S / 2 - 1) * (0.8 + 0.2 * n(Math.cos(a), Math.sin(a)));
    const d = Math.hypot(dx, dy) / r;
    return (1 - smoothstep(0.2, 1, d)) * 0.9;
  });
}

export interface MistBand {
  canvas: AnyCanvas;
  /** centre y and height (world units) */
  y: number;
  h: number;
  /** drift speed (world units / s, + = toward +x) */
  speed: number;
  /** peak alpha */
  alpha: number;
}

/** Horizontally tileable band of mist (world width 1600). */
function mistCanvas(rng: Rng, hWorld: number): AnyCanvas {
  const w = Math.ceil(WORLD_W * MIST_SCALE);
  const h = Math.max(4, Math.ceil(hWorld * MIST_SCALE));
  const period = 8;
  const body = createValueNoise2D(rng.fork('body'), period);
  const wisps = createValueNoise2D(rng.fork('wisps'), period * 4);
  return pixels(w, h, COLOURS.mist, (x, y) => {
    const u = (x / w) * period;
    const v = (y + 0.5) / h;
    // flatter, denser bottom; wispy, ragged top
    const top = smoothstep(0, 0.55, v + 0.18 * fbm(wisps, u * 4, v * 2, { octaves: 2 }));
    const bottom = 1 - smoothstep(0.62, 1, v);
    const mass = 0.25 + 0.75 * smoothstep(-0.35, 0.45, fbm(body, u, v * 1.5 + 3, { octaves: 3 }));
    const streak = 0.75 + 0.25 * wisps(u * 4, v * 10);
    return top * bottom * mass * streak;
  });
}

export interface Sprites {
  shafts: [AnyCanvas, AnyCanvas];
  /** [layer][variant] */
  rain: AnyCanvas[][];
  ripples: AnyCanvas[];
  glints: AnyCanvas[];
  /** [gold..., green...] */
  motes: AnyCanvas[];
  mist: MistBand[];
  flame: AnyCanvas;
}

export interface MistLayout {
  /** top of the pond (world y) — the far bank sits just above */
  pondTop: number;
  pondBottom: number;
}

/** Bands sit over the far bank and the far water, one faint low band in front. */
export function mistLayout(m: MistLayout): Array<Omit<MistBand, 'canvas'>> {
  return [
    { y: m.pondTop - 120, h: 170, speed: 3.5, alpha: 0.6 },
    { y: m.pondTop - 45, h: 110, speed: 6, alpha: 0.75 },
    { y: m.pondTop + 20, h: 70, speed: 8.5, alpha: 0.55 },
    { y: m.pondBottom + 70, h: 90, speed: 11, alpha: 0.22 },
  ];
}

export function buildSprites(seed: number | string, mist: MistLayout): Sprites {
  const rng = createRng(seed);
  const defs = shaftLayout(rng.fork('shafts'));
  const n = createSimplex2D(rng.fork('shaft-noise'));
  const streak = createSimplex2D(rng.fork('shaft-streak'));
  const v = Array.from({ length: SPRITE_VARIANTS }, (_, i) => i);
  return {
    shafts: [shaftCanvas([defs[0]!, defs[2]!], n, streak), shaftCanvas([defs[1]!, defs[3]!], n, streak)],
    rain: RAIN.layers.map((_, li) => v.map((i) => rainSprite(rng.fork(`rain-${li}-${i}`), li))),
    ripples: v.map((i) => rippleSprite(rng.fork(`ripple-${i}`))),
    glints: v.map((i) => glintSprite(rng.fork(`glint-${i}`))),
    motes: [0, 1, 2, 3].map((i) => moteSprite(rng.fork(`mote-${i}`), i < 2 ? COLOURS.moteGold : COLOURS.moteGreen)),
    mist: mistLayout(mist).map((b, i) => ({ ...b, canvas: mistCanvas(rng.fork(`mist-${i}`), b.h) })),
    flame: moteSprite(rng.fork('flame'), COLOURS.flame),
  };
}
