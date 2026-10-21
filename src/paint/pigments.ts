/**
 * Pigments: the named palette from docs/ART_DIRECTION.md plus colour maths in OKLab, a
 * perceptual space, so mixing, lightening and darkening behave like paint rather than like
 * sRGB arithmetic (no muddy greys mid-mix, no hue drift when darkening).
 *
 * A `Pigment` is just a `#rrggbb` string so it can be used anywhere a CSS colour is expected.
 */
import type { Rng } from '../core/rng';

export type Pigment = string;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

/** The project palette (ART_DIRECTION.md). Saturation is deliberately low. */
export const PIGMENTS = {
  /** washi paper ground */
  washi: '#f3ecd9',
  washiDeep: '#efe6cf',
  /** sap / sage greens — grass, foliage */
  sap: '#a9b386',
  sage: '#8d9a6c',
  sageLight: '#c3c79d',
  /** foliage darks */
  olive: '#6f7a52',
  /** pond */
  celadon: '#a9c3bb',
  celadonMid: '#8fb0ab',
  celadonDeep: '#6f9690',
  /** rocks */
  stone: '#9b978d',
  stoneDark: '#7d7a72',
  stoneWarm: '#a39a8b',
  /** sumi ink — lines, trunks (never pure black) */
  sumi: '#4a443c',
  /** pavilion wood */
  wood: '#8a7a68',
  woodLight: '#a69580',
  /** flowers */
  sakura: '#e8a7a9',
  sakuraLight: '#f1c6c3',
  iris: '#7b6ba8',
  irisLight: '#9a8cc4',
  bellflower: '#7f97c8',
  petalWhite: '#faf6ee',
  /** grey-violet shading for off-white petals */
  petalShade: '#c9c3d1',
  /** accents, sparingly */
  vermilion: '#d0694a',
  gold: '#d9b36c',
  /** cool shadow glaze (violet-grey), for shadows over any colour */
  shadow: '#8c8a9c',
} as const satisfies Record<string, Pigment>;

export type PigmentName = keyof typeof PIGMENTS;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Parse `#rgb` / `#rrggbb` (or a palette name) into 0..255 sRGB. */
export function hexToRgb(hex: Pigment | PigmentName): Rgb {
  const src = (PIGMENTS as Record<string, string>)[hex] ?? hex;
  let h = src.trim().replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`invalid pigment "${hex}"`);
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): Pigment {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => {
  const c = clamp01(v);
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
};

/** sRGB (0..255) → OKLab. */
export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → sRGB (0..255, gamut-clipped). */
export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const lab = (p: Pigment) => rgbToOklab(hexToRgb(p));
const hex = (o: Oklab) => rgbToHex(oklabToRgb(o));

/** Perceptual mix of two pigments: `t = 0` → `a`, `t = 1` → `b`. */
export function mix(a: Pigment, b: Pigment, t = 0.5): Pigment {
  const x = lab(a);
  const y = lab(b);
  const k = clamp01(t);
  return hex({ L: x.L + (y.L - x.L) * k, a: x.a + (y.a - x.a) * k, b: x.b + (y.b - x.b) * k });
}

/**
 * Raise perceptual lightness toward white by `amount` (0..1) of the remaining headroom. Like
 * thinning a wash with water, chroma drops a little too.
 */
export function lighten(p: Pigment, amount = 0.15): Pigment {
  const o = lab(p);
  const k = clamp01(amount);
  return hex({ L: o.L + (1 - o.L) * k, a: o.a * (1 - k * 0.5), b: o.b * (1 - k * 0.5) });
}

/** Lower perceptual lightness by `amount` (0..1, fraction of current L); chroma is kept. */
export function darken(p: Pigment, amount = 0.15): Pigment {
  const o = lab(p);
  return hex({ ...o, L: o.L * (1 - clamp01(amount)) });
}

/** Scale chroma (0 = grey, 1 = unchanged, >1 more saturated — use sparingly). */
export function saturate(p: Pigment, factor: number): Pigment {
  const o = lab(p);
  return hex({ L: o.L, a: o.a * factor, b: o.b * factor });
}

/** Lightness in OKLab (0..1). */
export function lightness(p: Pigment): number {
  return lab(p).L;
}

/** Chroma in OKLab (0 = neutral grey; the palette sits mostly below 0.08). */
export function chroma(p: Pigment): number {
  const o = lab(p);
  return Math.hypot(o.a, o.b);
}

/**
 * A cooler, darker version of `p` for shadows: darkened and nudged toward violet-grey, the way
 * a painter glazes shadows instead of adding black.
 */
export function shade(p: Pigment, amount = 0.25): Pigment {
  return darken(mix(p, PIGMENTS.shadow, amount * 0.6), amount * 0.5);
}

/**
 * A slightly varied copy of `p` so repeated dabs never match exactly: small random shifts of
 * lightness (±amount) and hue/chroma (±amount/2) in OKLab.
 */
export function jitter(p: Pigment, rng: Rng, amount = 0.03): Pigment {
  const o = lab(p);
  return hex({
    L: o.L + (rng.next() * 2 - 1) * amount,
    a: o.a + (rng.next() * 2 - 1) * amount * 0.35,
    b: o.b + (rng.next() * 2 - 1) * amount * 0.35,
  });
}

/** CSS `rgba()` string for `p` at alpha `a`. */
export function rgba(p: Pigment, a = 1): string {
  const { r, g, b } = hexToRgb(p);
  return `rgba(${r},${g},${b},${clamp01(a)})`;
}
