/**
 * The drying pass computes only the painted box plus the edge blur's reach (ADR 0349). Cropped
 * and whole-buffer drying must agree byte for byte on any layer: sparse marks, marks on the
 * buffer's edges and corners, open sides, both blur paths and every option branch.
 */
import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../core/rng';
import { createSimplex2D, noiseGrid } from './noise';
import { GRAIN_SIZE, paperGrain } from './paper';
import { DRY_DEFAULTS, drain, dryCrop, dryPixelsParts, resolveDry, type DryOptions, type GrainLookup, type OpenSides } from './wet';

const GRAIN = paperGrain(1).data;

function grainFor(w: number, h: number, rng: Rng): GrainLookup {
  const cols = new Int32Array(w);
  const rows = new Int32Array(h);
  const ox = rng.int(0, 200);
  const oy = rng.int(0, 200);
  for (let x = 0; x < w; x++) cols[x] = (ox + x) & (GRAIN_SIZE - 1);
  for (let y = 0; y < h; y++) rows[y] = ((oy + y) & (GRAIN_SIZE - 1)) * GRAIN_SIZE;
  return { data: GRAIN, cols, rows };
}

/** An ellipse of paint with ragged alpha (some pixels faint enough to shape to nothing). */
function blob(d: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, rx: number, ry: number, rng: Rng): void {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) {
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (q > 1) continue;
      const j = (y * w + x) * 4;
      d[j] = rng.int(0, 255);
      d[j + 1] = rng.int(0, 255);
      d[j + 2] = rng.int(0, 255);
      d[j + 3] = Math.max(d[j + 3]!, q > 0.8 ? rng.int(1, 40) : rng.int(1, 255));
    }
  }
}

interface Layer {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  edgePx: number;
  open: OpenSides;
  o: ReturnType<typeof resolveDry>;
  grain: GrainLookup;
  flow: ReturnType<typeof noiseGrid> | null;
}

function layer(seed: string, marks: (d: Uint8ClampedArray, w: number, h: number, rng: Rng) => void, size?: { w: number; h: number }): Layer {
  const rng = createRng(seed);
  const w = size?.w ?? rng.int(9, 320);
  const h = size?.h ?? rng.int(9, 260);
  const data = new Uint8ClampedArray(w * h * 4);
  marks(data, w, h, rng);
  const opts: DryOptions = {
    sharpness: rng.pick([0, 0.6, 1]),
    flow: rng.pick([0, 0.35, 0.8]),
    granules: rng.pick([0, 0.3]),
    dry: rng.pick([0, 0.4]),
    speckle: rng.pick([0, 0.5]),
    edge: rng.range(0, 1),
  };
  const o = resolveDry(opts, DRY_DEFAULTS);
  const flow = o.flow > 0 ? noiseGrid(createSimplex2D(createRng(`${seed}-flow`)), w, h, rng.pick([3, 5, 9]), rng.range(10, 60), { octaves: 3, ox: rng.range(-50, 50), oy: rng.range(-50, 50) }) : null;
  const open = { l: rng.chance(0.3), t: rng.chance(0.3), r: rng.chance(0.3), b: rng.chance(0.3) };
  return { w, h, data, edgePx: rng.pick([1, 2.5, 3.4, 6, 14, 30, 48]), open, o, grain: grainFor(w, h, rng), flow };
}

/** Dry a layer whole and cropped; the bytes that differ (0 when bit-identical). */
function differs(L: Layer): number {
  const whole = L.data.slice();
  const cropped = L.data.slice();
  drain(dryPixelsParts(whole, L.w, L.h, L.o, L.edgePx, L.grain, L.flow, L.open, 1 << 16, false));
  drain(dryPixelsParts(cropped, L.w, L.h, L.o, L.edgePx, L.grain, L.flow, L.open, 1 << 16, true));
  let n = 0;
  for (let i = 0; i < whole.length; i++) if (whole[i] !== cropped[i]) n++;
  return n;
}

describe('drying skips the empty part of a layer, bit for bit (ADR 0349)', () => {
  it('random sparse layers dry exactly as the whole buffer', () => {
    for (let k = 0; k < 120; k++) {
      const L = layer(`sparse-${k}`, (d, w, h, rng) => {
        for (let b = rng.int(1, 4); b > 0; b--) blob(d, w, h, rng.range(0, w), rng.range(0, h), rng.range(0.5, w / 6), rng.range(0.5, h / 6), rng);
      });
      expect(differs(L), `layer ${k} ${L.w}×${L.h} edge ${L.edgePx}`).toBe(0);
    }
  });

  it('a stroke on a 32-pixel tile edge and strokes against each side and corner of the layer', () => {
    const cases: [string, (d: Uint8ClampedArray, w: number, h: number, rng: Rng) => void][] = [
      ['tile edge', (d, w, h, rng) => blob(d, w, h, 31.5, 63.5, 4, 30, rng)],
      ['left', (d, w, h, rng) => blob(d, w, h, 0, h / 2, 3, 20, rng)],
      ['right', (d, w, h, rng) => blob(d, w, h, w - 1, h / 2, 3, 20, rng)],
      ['top', (d, w, h, rng) => blob(d, w, h, w / 2, 0, 20, 3, rng)],
      ['bottom', (d, w, h, rng) => blob(d, w, h, w / 2, h - 1, 20, 3, rng)],
      ['near the bottom-right', (d, w, h, rng) => blob(d, w, h, w - 9, h - 7, 5, 4, rng)],
      ['corners', (d, w, h, rng) => {
        for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) blob(d, w, h, x, y, 2, 2, rng);
      }],
      ['one pixel', (d, w) => {
        const j = (37 * w + 41) * 4;
        d[j] = 200;
        d[j + 3] = 180;
      }],
    ];
    for (const [name, marks] of cases) {
      for (let k = 0; k < 14; k++) {
        const L = layer(`${name}-${k}`, marks, { w: 160 + k * 7, h: 128 + k * 5 });
        expect(differs(L), `${name} #${k} edge ${L.edgePx}`).toBe(0);
      }
    }
  });

  it('the crop covers the painted box and the blur reach, on even pixels, inside the buffer', () => {
    const c = dryCrop({ x0: 100, y0: 81, x1: 120, y1: 90 }, 400, 300, 10, true);
    expect(c).toEqual({ x0: 74, y0: 54, x1: 146, y1: 116 });
    expect(dryCrop({ x0: 3, y0: 2, x1: 398, y1: 299 }, 400, 300, 10, true)).toEqual({ x0: 0, y0: 0, x1: 400, y1: 300 });
    // the full-resolution blur reaches 2 r + 2
    expect(dryCrop({ x0: 50, y0: 50, x1: 60, y1: 60 }, 400, 300, 1.5, false)).toEqual({ x0: 44, y0: 44, x1: 66, y1: 66 });
  });
});
