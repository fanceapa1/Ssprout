import { describe, expect, it } from 'vitest';
import {
  MAX_TEAR,
  SHADOW_PAD,
  SHEET,
  createTear,
  grainOffset,
  sheetFibres,
  sheetMaskSvg,
  sheetOutline,
  sheetShadowSvg,
  shadowLayers,
  svgData,
  type Side,
} from './backdrop-sheet';

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

describe('backdrop sheet · the torn edge', () => {
  it('stays inside the box, never deeper than MAX_TEAR, for any size', () => {
    for (const [w, h] of [
      [300, 120],
      [1046, 640],
      [330, 2400],
    ] as const) {
      const tear = createTear('session');
      for (const side of SIDES) {
        const len = side === 'top' || side === 'bottom' ? w : h;
        for (let s = 0; s <= len; s += 3) {
          const d = tear.at(side, s, w, h);
          expect(d).toBeGreaterThan(0);
          expect(d).toBeLessThanOrEqual(MAX_TEAR);
        }
      }
      for (const p of sheetOutline('session', w, h)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(w);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(h);
      }
    }
  });

  it('is torn, not ruled: the edge wanders by a few pixels along each side', () => {
    const tear = createTear('calendar');
    for (const side of SIDES) {
      const ds = Array.from({ length: 200 }, (_, i) => tear.at(side, 60 + i * 4, 1000, 1000));
      const spread = Math.max(...ds) - Math.min(...ds);
      expect(spread).toBeGreaterThan(1.5);
      // no zig-zag: neighbours 4 px apart differ by less than 2 px
      for (let i = 1; i < ds.length; i++) expect(Math.abs(ds[i]! - ds[i - 1]!)).toBeLessThan(2);
    }
  });

  it('is seeded per section: stable for one seed, different between sections', () => {
    expect(sheetOutline('plant', 600, 400)).toEqual(sheetOutline('plant', 600, 400));
    const a = sheetOutline('plant', 600, 400).map((p) => p.y).slice(0, 40);
    const b = sheetOutline('tools', 600, 400).map((p) => p.y).slice(0, 40);
    expect(a).not.toEqual(b);
  });

  it('keeps its edges when the sheet grows taller: the top and the sides are unchanged', () => {
    const tear = createTear('session');
    for (let s = 0; s <= 900; s += 5) expect(tear.at('top', s, 900, 700)).toBe(tear.at('top', s, 900, 300));
    // the sides away from the lower corner (whose chip moves down with it)
    for (let s = 0; s <= 250; s += 5) {
      expect(tear.at('left', s, 900, 700)).toBe(tear.at('left', s, 900, 300));
      expect(tear.at('right', s, 900, 700)).toBe(tear.at('right', s, 900, 300));
    }
    // the lower edge keeps its shape, just lower down
    for (let s = 0; s <= 900; s += 5) expect(tear.at('bottom', s, 900, 700)).toBe(tear.at('bottom', s, 900, 300));
  });

  it('frays: fibres stand out of the edge in a seeded, stable place, inside the box', () => {
    const f = sheetFibres('session', 800, 500);
    expect(f.length).toBeGreaterThan(20);
    for (const [p, q] of f) {
      expect(q.x).toBeGreaterThanOrEqual(0);
      expect(q.x).toBeLessThanOrEqual(800);
      expect(q.y).toBeGreaterThanOrEqual(0);
      expect(q.y).toBeLessThanOrEqual(500);
      expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeLessThan(6);
    }
    // a taller sheet keeps the fibres of its top edge
    const top = (list: typeof f) => list.filter(([p]) => p.y < 20).map(([p]) => p);
    expect(top(sheetFibres('session', 800, 900))).toEqual(top(f));
  });
});

describe('backdrop sheet · the pooled wash under it', () => {
  it('lies under the lower and right edges, never out to the left (the path lane) or above', () => {
    const w = 900;
    const h = 600;
    for (const style of [SHEET.leaf, SHEET.firm]) {
      const layers = shadowLayers('calendar', w, h, style);
      expect(layers.length).toBeGreaterThanOrEqual(4);
      for (const l of layers)
        for (const p of l) {
          expect(p.x).toBeGreaterThanOrEqual(1);
          expect(p.y).toBeGreaterThanOrEqual(1);
          expect(p.x).toBeLessThanOrEqual(w + SHADOW_PAD);
          expect(p.y).toBeLessThanOrEqual(h + SHADOW_PAD);
        }
      const outer = layers[0]!;
      const maxY = Math.max(...outer.map((p) => p.y));
      const maxX = Math.max(...outer.map((p) => p.x));
      // on the left it stays under the sheet's own edge, clear of the path's lane
      const minX = Math.min(...outer.map((p) => p.x));
      // it reaches past the lower edge further than past the right one, and stays inside on the left
      expect(maxY - h).toBeGreaterThan(maxX - w);
      expect(maxY).toBeGreaterThan(h + 2);
      expect(minX).toBeGreaterThan(1);
    }
  });

  it('the calendar’s firm sheet is lifted further and casts a deeper wash than a leaf', () => {
    expect(SHEET.firm.lift).toBeGreaterThan(SHEET.leaf.lift);
    expect(SHEET.firm.depth).toBeGreaterThan(SHEET.leaf.depth);
    expect(SHEET.firm.glaze).toBeGreaterThan(SHEET.leaf.glaze);
    const reach = (style: typeof SHEET.leaf) => Math.max(...shadowLayers('x', 800, 400, style)[0]!.map((p) => p.y)) - 400;
    expect(reach(SHEET.firm)).toBeGreaterThan(reach(SHEET.leaf));
  });
});

describe('backdrop sheet · the images', () => {
  it('draws the mask and the wash at the sheet’s pixel size, so the tear never stretches', () => {
    const mask = sheetMaskSvg('plant', 640, 380);
    expect(mask).toContain("width='640' height='380' viewBox='0 0 640 380'");
    const shadow = sheetShadowSvg('plant', 640, 380);
    expect(shadow).toContain(`viewBox='0 0 ${640 + SHADOW_PAD} ${380 + SHADOW_PAD}'`);
    // glazes, not a flat drop shadow: several translucent layers and a broken rim
    expect(shadow.match(/fill-opacity=/g)!.length).toBeGreaterThanOrEqual(4);
    expect(shadow).toContain('stroke-dasharray');
    expect(shadow).not.toMatch(/filter|blur|Gradient/);
  });

  it('escapes only what a CSS data URL needs', () => {
    const url = svgData(`<svg fill='#abc'>100%</svg>`);
    expect(url).toBe(`url("data:image/svg+xml,%3Csvg fill='%23abc'%3E100%25%3C/svg%3E")`);
  });

  it('offsets the shared paper tile per section, so the leaf’s grain never lines up with the page’s', () => {
    const a = grainOffset('session');
    expect(grainOffset('session')).toEqual(a);
    expect(grainOffset('calendar')).not.toEqual(a);
    for (const v of [a.x, a.y]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(512);
    }
  });
});
