import { createRng } from '../core/rng';
import { createValueNoise2D, type Noise2D } from '../paint/noise';

/**
 * A dock section's backdrop (ADR 0208): a leaf of washi laid on the page, a little lighter than the
 * page, with a torn, fibrous edge and a cool wash pooled under its lower and right edges, as if the
 * painting went on over separate sheets. This file is the pure geometry, shared by the page
 * (`backdrop.ts`, SVG) and the studio (canvas):
 *
 * - `sheetOutline`: the torn edge, in CSS pixels of the sheet's own box. Each side's tear is a
 *   function of the position along that side, measured from the top or left corner, so a sheet that
 *   grows or narrows keeps its edges: only the new length is new (`edge stays when the sheet grows`).
 * - `shadowLayers`: the pooled wash under it, a few jittered glazes (the paint engine's wet-edge
 *   method), offset down and to the right, never out to the left or up (the path's lane is left).
 * - `sheetMaskSvg` / `sheetShadowSvg`: the two SVG images the page lays (a mask and a background).
 *
 * The tear always stays inside the box (`0 < inset ≤ MAX_TEAR`), so the box can be measured and
 * tested as the sheet's bounds.
 */
export type SheetStrength = 'leaf' | 'firm';

export interface SheetStyle {
  /** opacity of the white lifted over the shared paper tile: how much lighter than the page */
  lift: number;
  /** how far the shadow's wash reaches past the lower edge (px); the right edge gets 45 % of it */
  depth: number;
  /** opacity of each glaze in the shadow */
  glaze: number;
  /** opacity of the shadow's pooled rim */
  rim: number;
  /** multiplies the tear's amplitude */
  tear: number;
}

export const SHEET: Readonly<Record<SheetStrength, SheetStyle>> = {
  // every section: lifted a little, a thin shadow
  leaf: { lift: 0.44, depth: 19, glaze: 0.019, rim: 0.07, tear: 1 },
  // the calendar: a firmer, brighter surface and a deeper wash under it
  firm: { lift: 0.74, depth: 25, glaze: 0.026, rim: 0.1, tear: 1.15 },
};

/** The deepest the torn edge cuts into the box (px). */
export const MAX_TEAR = 10;
/** How far the shadow layer reaches past the sheet's box, right and below (px). */
export const SHADOW_PAD = 36;
/** The shadow's pigment: a cool violet grey, never a grey drop shadow (ART_DIRECTION › daylight). */
export const SHADOW_INK = '#5d5b7e';
const GLAZES = 9;

export type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

export interface Pt {
  x: number;
  y: number;
}

interface Corner {
  /** how deep the chip cuts (px) */
  depth: number;
  /** how far along each side it runs (px) */
  reach: number;
}

export interface Tear {
  /** inset of the torn edge (px, > 0) at `s` px along `side` (from its top or left end), for a box `w × h` */
  at(side: Side, s: number, w: number, h: number): number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The torn edge for `seed`: three octaves of value noise per side (a slow wave, the tear, the
 * fibres) and a chipped corner at each of the four corners. Pure and deterministic.
 */
export function createTear(seed: string, amount = 1): Tear {
  const rng = createRng(`sheet:${seed}`);
  const octaves: Record<Side, [Noise2D, Noise2D, Noise2D]> = {} as never;
  for (const side of SIDES) {
    const r = rng.fork(side);
    octaves[side] = [createValueNoise2D(r.fork('wave'), 256), createValueNoise2D(r.fork('tear'), 256), createValueNoise2D(r.fork('fibre'), 256)];
  }
  const corners: Corner[] = [0, 1, 2, 3].map(() => ({ depth: rng.range(1.5, 4.5), reach: rng.range(16, 44) }));
  // the sheet lies a hair askew: its top and lower edges lean by up to 3 px from end to end (the
  // sides do not lean, so a sheet that grows taller keeps its sides exactly)
  const skew = [0, 1, 2, 3].map(() => rng.range(0, 3));
  // corners in order: top-left, top-right, bottom-right, bottom-left
  const chip = (c: Corner, d: number) => (d < c.reach ? c.depth * (1 - d / c.reach) ** 2 : 0);
  return {
    at(side, s, w, h) {
      const [wave, tear, fibre] = octaves[side];
      const n = 1.6 * wave(s / 90, 0.5) + 1.25 * tear(s / 13, 3.5) + 0.55 * fibre(s / 3, 7.5);
      const len = side === 'top' || side === 'bottom' ? w : h;
      const [k0, k1] = side === 'top' ? [skew[0]!, skew[1]!] : side === 'bottom' ? [skew[3]!, skew[2]!] : [0, 0];
      const t = len > 0 ? clamp(s / len, 0, 1) : 0;
      let inset = 3.6 + n * amount + k0 + (k1 - k0) * t;
      const [a, b] =
        side === 'top' ? [corners[0]!, corners[1]!] : side === 'right' ? [corners[1]!, corners[2]!] : side === 'bottom' ? [corners[3]!, corners[2]!] : [corners[0]!, corners[3]!];
      inset += chip(a, s) + chip(b, len - s);
      return clamp(inset, 0.4, MAX_TEAR);
    },
  };
}

/**
 * Walk a box's four sides clockwise from the top-left corner, every `step` px, placing each point
 * `inset(side, s)` px inside the side (negative: outside it).
 */
export function walkBox(w: number, h: number, step: number, inset: (side: Side, s: number) => number): Pt[] {
  const pts: Pt[] = [];
  const n = (len: number) => Math.max(2, Math.ceil(len / step));
  const nw = n(w);
  const nh = n(h);
  for (let i = 0; i < nw; i++) {
    const s = (w * i) / nw;
    pts.push({ x: s, y: inset('top', s) });
  }
  for (let i = 0; i < nh; i++) {
    const s = (h * i) / nh;
    pts.push({ x: w - inset('right', s), y: s });
  }
  for (let i = nw; i > 0; i--) {
    const s = (w * i) / nw;
    pts.push({ x: s, y: h - inset('bottom', s) });
  }
  for (let i = nh; i > 0; i--) {
    const s = (h * i) / nh;
    pts.push({ x: inset('left', s), y: s });
  }
  return pts;
}

/** The sheet's torn outline in its own box (`w × h` CSS px). `grow` moves it outwards (the fringe). */
export function sheetOutline(seed: string, w: number, h: number, opts: { step?: number; grow?: number; style?: SheetStyle } = {}): Pt[] {
  const tear = createTear(seed, (opts.style ?? SHEET.leaf).tear);
  const grow = opts.grow ?? 0;
  return walkBox(w, h, opts.step ?? 5, (side, s) => tear.at(side, s, w, h) - grow);
}

/**
 * The fibres that stand out of the torn edge: short, slightly bent hairs, seeded by their place on
 * the side (one every ~36 px), so they stay put when the sheet grows. Each is [from, to].
 */
export function sheetFibres(seed: string, w: number, h: number, style: SheetStyle = SHEET.leaf): Array<[Pt, Pt]> {
  const tear = createTear(seed, style.tear);
  const out: Array<[Pt, Pt]> = [];
  const SPACING = 36;
  for (const side of SIDES) {
    const len = side === 'top' || side === 'bottom' ? w : h;
    for (let k = 0; k * SPACING < len; k++) {
      const r = createRng(`fibre:${seed}:${side}:${k}`);
      if (r.next() < 0.35) continue;
      const s = k * SPACING + r.range(4, SPACING - 4);
      if (s < 10 || s > len - 10) continue;
      const d = tear.at(side, s, w, h);
      const out1 = r.range(1.2, 4.2); // how far it stands out of the edge
      const lean = r.range(-3, 3);
      const p =
        side === 'top' ? { x: s, y: d } : side === 'right' ? { x: w - d, y: s } : side === 'bottom' ? { x: s, y: h - d } : { x: d, y: s };
      const q =
        side === 'top'
          ? { x: s + lean, y: d - out1 }
          : side === 'right'
            ? { x: w - d + out1, y: s + lean }
            : side === 'bottom'
              ? { x: s + lean, y: h - d + out1 }
              : { x: d - out1, y: s + lean };
      out.push([p, { x: clamp(q.x, 0, w), y: clamp(q.y, 0, h) }]);
    }
  }
  return out;
}

/** How far the shadow's wash reaches out past each side (negative: it stays under the sheet). */
const SHADOW_SIDE: Record<Side, number> = { top: -0.7, right: 0.45, bottom: 1, left: -0.7 };

/**
 * The pooled wash under the sheet: `GLAZES` jittered outlines, each reaching a little less far
 * (so the wash is deepest along the edge and soft at its end), in the sheet's own box. Points may
 * reach `SHADOW_PAD` past the right and lower sides, never past the left or the top.
 */
export function shadowLayers(seed: string, w: number, h: number, style: SheetStyle = SHEET.leaf): Pt[][] {
  const tear = createTear(seed, style.tear);
  const rng = createRng(`shadow:${seed}`);
  const dx = style.depth * 0.14;
  const dy = style.depth * 0.22;
  // the wash pools unevenly: deeper in places along the edge, nearly gone in others
  const pool = createValueNoise2D(rng.fork('pool'), 256);
  const layers: Pt[][] = [];
  for (let i = 0; i < GLAZES; i++) {
    const jitter = createValueNoise2D(rng.fork(`glaze-${i}`), 256);
    const reach = style.depth * (1 - (i / GLAZES) * 0.9);
    const pts = walkBox(w, h, 12, (side, s) => {
      const p = 0.6 + 0.45 * pool(s / 170, side === 'bottom' ? 1.5 : 6.5);
      const out = SHADOW_SIDE[side] * reach * (SHADOW_SIDE[side] > 0 ? p : 1) + 1.6 * jitter(s / 48, i * 3.1);
      return tear.at(side, s, w, h) - out;
    });
    layers.push(
      pts.map((p) => ({
        x: clamp(p.x + dx, 1, w + SHADOW_PAD - 1),
        y: clamp(p.y + dy, 1, h + SHADOW_PAD - 1),
      })),
    );
  }
  return layers;
}

/** An SVG path from points, one decimal. */
export function pathOf(pts: readonly Pt[]): string {
  return `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`;
}

/**
 * The sheet's mask: the torn shape in white, a translucent fringe just outside it (where the fibres
 * thin out) and the loose fibres. Sized in CSS pixels, laid at 100 % × 100 %.
 */
export function sheetMaskSvg(seed: string, w: number, h: number, style: SheetStyle = SHEET.leaf): string {
  const body = pathOf(sheetOutline(seed, w, h, { style }));
  const fringe = pathOf(sheetOutline(`${seed}:fringe`, w, h, { style, grow: 1.4 }));
  const hairs = sheetFibres(seed, w, h, style)
    .map(([p, q]) => `M${p.x.toFixed(1)} ${p.y.toFixed(1)}Q${((p.x + q.x) / 2 + 0.6).toFixed(1)} ${((p.y + q.y) / 2 - 0.6).toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
    .join('');
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>` +
    `<path d='${fringe}' fill='white' fill-opacity='0.5'/>` +
    `<path d='${body}' fill='white'/>` +
    (hairs ? `<path d='${hairs}' fill='none' stroke='white' stroke-opacity='0.55' stroke-width='0.7' stroke-linecap='round'/>` : '') +
    `</svg>`
  );
}

/**
 * The shadow image (`(w + SHADOW_PAD) × (h + SHADOW_PAD)`): the glazes, then a broken pooled rim
 * along the outermost one (pigment gathers where a wash dries).
 */
export function sheetShadowSvg(seed: string, w: number, h: number, style: SheetStyle = SHEET.leaf): string {
  const W = w + SHADOW_PAD;
  const H = h + SHADOW_PAD;
  const layers = shadowLayers(seed, w, h, style);
  const rng = createRng(`rim:${seed}`);
  const a = rng.int(300, 700);
  const b = rng.int(150, 400);
  const c = rng.int(500, 900);
  const e = rng.int(200, 500);
  const glazes = layers.map((l) => `<path d='${pathOf(l)}' fill='${SHADOW_INK}' fill-opacity='${style.glaze}'/>`).join('');
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'>` +
    glazes +
    `<path d='${pathOf(layers[0]!)}' fill='none' stroke='${SHADOW_INK}' stroke-opacity='${style.rim}' stroke-width='1' stroke-linejoin='round' ` +
    `pathLength='4000' stroke-dasharray='${a} ${b} ${c} ${e} ${4000 - a - b - c - e} 0'/>` +
    `</svg>`
  );
}

/** A data URL for an SVG written with single-quoted attributes: only the few characters CSS and URLs need escaped. */
export function svgData(svg: string): string {
  return `url("data:image/svg+xml,${svg.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, '%22')}")`;
}

/** Where the shared paper tile starts under a sheet (px), seeded, so its grain never lines up with the page's. */
export function grainOffset(seed: string): { x: number; y: number } {
  const r = createRng(`grain:${seed}`);
  return { x: r.int(0, 511), y: r.int(0, 511) };
}
