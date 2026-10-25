/**
 * Pre-painted textures for the ambience, built once per scene and each on its first use (never per frame): the sun's
 * glaze with its lifted light, rain strokes, ripple rings, glints, motes, mist bands, the lantern flame. Each is computed per
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
  /** the sun's thin warm glaze (multiply): a raw-sienna / quinacridone-gold wash, laid very thin */
  sunGlaze: [228, 204, 158] as Rgb,
  /** sunlight caught on a leaf (screen): a warm lifted dab */
  leafGlint: [255, 236, 186] as Rgb,
  /** ink-wash rain, grey-blue (multiply) */
  rain: [92, 108, 122] as Rgb,
  /** ripple line: deep celadon, and the lifted pale line beside it */
  rippleDark: [88, 124, 122] as Rgb,
  rippleLight: [250, 248, 238] as Rgb,
  /** sun on the water: warm, not white */
  glint: [255, 242, 208] as Rgb,
  moteGold: [234, 206, 124] as Rgb,
  moteGreen: [214, 228, 150] as Rgb,
  mist: [246, 244, 238] as Rgb,
  flame: [246, 222, 170] as Rgb,
} as const;

export const SUN_SCALE = 0.2;
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

/**
 * Sunny weather as a watercolourist paints it (ADR 0193): not pale columns of added light, but a
 * thin warm glaze over the garden with soft diagonal bands of light *lifted out* of it while it was
 * damp — the paper shows through where the light falls, the lifted pigment pools a little at each
 * band's edge, and the glaze fades out above the hills so the sky is never striped.
 */
export interface SunBand {
  /** where the band enters (world units): upper left, at the hills */
  x0: number;
  y0: number;
  /** lean from vertical (rad, + falls toward +x) */
  angle: number;
  width: number;
  length: number;
}

export interface SunLayout {
  /** top of the pond (world y): the far bank and the hills sit above it */
  pondTop: number;
}

/** Four bands of light falling from the upper left across the garden, two groups breathing in turn. */
export function sunBands(rng: Rng, layout: SunLayout): SunBand[] {
  const y0 = layout.pondTop - 210;
  const xs = [-120, 300, 700, 1100];
  return xs.map((x, i) => ({
    x0: x + rng.range(-50, 50),
    y0: y0 + rng.range(-20, 20),
    angle: 0.62 + rng.range(-0.05, 0.05),
    width: [300, 190, 260, 160][i]! * rng.range(0.85, 1.15),
    length: rng.range(900, 1150),
  }));
}

/** How much glaze the garden carries at height `wy`: little over the sky, all of it on the ground. */
export function sunGround(wy: number, layout: SunLayout): number {
  return 0.15 + 0.85 * smoothstep(layout.pondTop - 260, layout.pondTop - 40, wy);
}

/**
 * The glaze's strength at a world point (0..1, before `LOOK.sunGlaze`), with the bands in `lifted`
 * (`[band, how much]`) lifted out. Pure, so tests can read it: lifted light is paler than the glaze, edges pool a little
 * darker, and nothing is lifted above the hills.
 */
export function sunGlazeAt(wx: number, wy: number, bands: readonly SunBand[], lifted: readonly (readonly [number, number])[], layout: SunLayout, noise: Noise2D | null = null): number {
  const ground = sunGround(wy, layout);
  const mottle = noise ? 0.86 + 0.14 * noise(wx / 260, wy / 220) : 1;
  let lift = 0;
  let rim = 0;
  for (const [i, amount] of lifted) {
    const b = bands[i];
    if (!b) continue;
    const sa = Math.sin(b.angle);
    const ca = Math.cos(b.angle);
    const dx = wx - b.x0;
    const dy = wy - b.y0;
    const along = dx * sa + dy * ca;
    if (along <= 0 || along >= b.length) continue;
    const across = dx * ca - dy * sa;
    const len = along / b.length;
    // the tissue lifts unevenly: the band's width wanders slowly along its length
    const ragged = noise ? 1 + 0.16 * noise(along / 340, i * 7.3) : 1;
    const half = (b.width / 2) * ragged * (0.8 + 0.4 * len);
    const k = Math.abs(across) / half;
    // the light comes in soft from the hills and dies away on the near bank
    const lengthwise = smoothstep(0, 0.18, len) * (1 - smoothstep(0.62, 1, len)) * smoothstep(layout.pondTop - 230, layout.pondTop - 40, wy);
    lift = Math.max(lift, (1 - smoothstep(0.2, 1, k)) * lengthwise * amount);
    rim = Math.max(rim, Math.exp(-(((k - 1.05) / 0.2) ** 2)) * lengthwise * amount);
  }
  return clamp01(0.85 * ground * mottle * (1 - 0.92 * lift + 0.16 * rim));
}

function sunCanvas(bands: SunBand[], lifted: Array<[number, number]>, layout: SunLayout, noise: Noise2D): AnyCanvas {
  const w = Math.ceil(WORLD_W * SUN_SCALE);
  const h = Math.ceil(WORLD_H * SUN_SCALE);
  return pixels(w, h, COLOURS.sunGlaze, (px, py) => sunGlazeAt((px + 0.5) / SUN_SCALE, (py + 0.5) / SUN_SCALE, bands, lifted, layout, noise));
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
  /** the sun's glaze, with the first and the second group of bands lifted out */
  sun: [AnyCanvas, AnyCanvas];
  /** [layer][variant] */
  rain: AnyCanvas[][];
  ripples: AnyCanvas[];
  glints: AnyCanvas[];
  /** warm dabs of sunlight caught on leaves */
  leafGlints: AnyCanvas[];
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

/**
 * Bands hug the far bank and the far water, where mist gathers; the near garden (where the plants
 * are) stays clear but for one wisp lying low on the water.
 */
export function mistLayout(m: MistLayout): Array<Omit<MistBand, 'canvas'>> {
  return [
    { y: m.pondTop - 110, h: 150, speed: 3.5, alpha: 0.42 },
    { y: m.pondTop - 40, h: 100, speed: 6, alpha: 0.55 },
    { y: m.pondTop + 22, h: 60, speed: 8.5, alpha: 0.4 },
    { y: (m.pondTop + m.pondBottom) / 2 + 30, h: 46, speed: 11, alpha: 0.16 },
  ];
}

/** The sprite groups `buildSprites` builds, each on its first use. */
export const SPRITE_GROUPS = ['sun', 'rain', 'ripples', 'glints', 'leafGlints', 'motes', 'mist', 'flame'] as const;
export type SpriteGroup = (typeof SPRITE_GROUPS)[number];

const built = new WeakMap<Sprites, Set<SpriteGroup>>();

/** Which groups of a `buildSprites` set are painted so far (for tests and `ambienceDebug`). */
export function builtSprites(sprites: Sprites): SpriteGroup[] {
  const s = built.get(sprites);
  return s ? SPRITE_GROUPS.filter((g) => s.has(g)) : [...SPRITE_GROUPS];
}

/**
 * The ambience's sprites, each group painted on its first use (ADR 0232): the sun's two glaze
 * sprites (the largest, ~50 ms) are never painted at night or without sun weather, the rain's
 * strokes only for rain. Every group draws from its own fork of the seed, so a group comes out the
 * same whichever is built first.
 */
export function buildSprites(seed: number | string, mist: MistLayout): Sprites {
  const rng = createRng(seed);
  const v = Array.from({ length: SPRITE_VARIANTS }, (_, i) => i);
  const make: { [G in SpriteGroup]: () => Sprites[G] } = {
    sun: () => {
      const sunLayout = { pondTop: mist.pondTop };
      const bands = sunBands(rng.fork('sun'), sunLayout);
      const n = createSimplex2D(rng.fork('sun-noise'));
      // every band is lifted in both; each sprite favours one group, so the light shifts as they take turns
      return [
        sunCanvas(bands, [[0, 1], [2, 1], [1, 0.5], [3, 0.5]], sunLayout, n),
        sunCanvas(bands, [[1, 1], [3, 1], [0, 0.5], [2, 0.5]], sunLayout, n),
      ];
    },
    rain: () => RAIN.layers.map((_, li) => v.map((i) => rainSprite(rng.fork(`rain-${li}-${i}`), li))),
    ripples: () => v.map((i) => rippleSprite(rng.fork(`ripple-${i}`))),
    glints: () => v.map((i) => glintSprite(rng.fork(`glint-${i}`))),
    leafGlints: () => v.map((i) => moteSprite(rng.fork(`leaf-glint-${i}`), COLOURS.leafGlint)),
    motes: () => [0, 1, 2, 3].map((i) => moteSprite(rng.fork(`mote-${i}`), i < 2 ? COLOURS.moteGold : COLOURS.moteGreen)),
    mist: () => mistLayout(mist).map((b, i) => ({ ...b, canvas: mistCanvas(rng.fork(`mist-${i}`), b.h) })),
    flame: () => moteSprite(rng.fork('flame'), COLOURS.flame),
  };
  const done = new Set<SpriteGroup>();
  const cache: Partial<Sprites> = {};
  const sprites = {} as Sprites;
  for (const g of SPRITE_GROUPS) {
    Object.defineProperty(sprites, g, {
      enumerable: true,
      get() {
        if (!done.has(g)) {
          (cache as Record<SpriteGroup, unknown>)[g] = make[g]();
          done.add(g);
        }
        return cache[g];
      },
    });
  }
  built.set(sprites, done);
  return sprites;
}
