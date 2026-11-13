/**
 * The coast's daylight (G5, ADR 0372). docs/TESTING.md › G5.1.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CAST_SCALE, castPrint, lightPlateKey, paintCastPlate, type LightArt } from '../../ambience/cast';
import { only, PHASES, pinnedState, type DayPhase, type DaylightState } from '../../ambience/daylight';
import { moonDisc, stars, sunDisc } from '../../ambience/sky-layout';
import { gradeFor, PHASE_GRADES } from '../../ambience/timeofday';
import { createRng } from '../../core/rng';
import { createPainter, hexToRgb, makeCanvas } from '../../paint';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { createViewport, type Rect } from '../../render/viewport';
import type { SceneGeometry } from '../../scene/geometry';
import { PaintRecorder } from '../../scene/paint-record';
import { SKY_SCALE } from '../../scene/paint-sky';
import { skyPlateKey, WATER_SKY_ALPHA } from '../../scene/sky-light';
import type { ScenerySky } from '../types';
import { OASIS } from '../oasis';
import { COAST, COAST_LIGHT_ART, COAST_SKY } from '.';
import { COAST_GRADES, COAST_WATER_ALPHA } from './daylight';
import { CHAPEL, COAST_SKY_LAYOUT, COLUMNS, OLIVE, skylineAt, STYLOBATE, VILLAGE } from './layout';
import { CHAPEL_LAMP, COAST_LIGHT, LIT_WINDOWS } from './light';
import { PINE_PADS, VILLAGE_CUBES } from './shapes';
import { COAST_NIGHT_STARS, COAST_SKY_RECT, COAST_WATER_SKY, groundAt, plateSky, TEMPLE_CUT, WATER_NEAR } from './sky';
import { columnShapes } from './temple';

// the painters are a lazy chunk (ADR 0341)
beforeAll(() => Promise.all([COAST.painters.load(), OASIS.painters.load()]));

interface Plates {
  hash: string;
  calls: number;
  pixels: number;
}

/** Paint every phase's sky, water and light plate the way the renderer does, recorded. */
function recordPlates(sky: ScenerySky, scene: SceneGeometry, art: LightArt, seed: number): Record<DayPhase, Plates> {
  const out = {} as Record<DayPhase, Plates>;
  const pond: Rect = bounds(scene.pond);
  for (const phase of PHASES) {
    const rec = new PaintRecorder();
    const uninstall = rec.install();
    try {
      rec.mark();
      const r = sky.rect;
      const s = createPainter(makeCanvas(Math.ceil(r.w * SKY_SCALE), Math.ceil(r.h * SKY_SCALE)), { seed: `${seed}:sky:${phase}` });
      s.ctx.setTransform(SKY_SCALE, 0, 0, SKY_SCALE, -r.x * SKY_SCALE, -r.y * SKY_SCALE);
      sky.painters.get()!.sky.paint(s, createRng(`${seed}:sky:${phase}`), phase);
      const w = createPainter(makeCanvas(Math.ceil(pond.w * 0.5) + 20, Math.ceil(pond.h * 0.5) + 20), { seed: `${seed}:water-sky:${phase}` });
      w.ctx.setTransform(0.5, 0, 0, 0.5, -pond.x * 0.5 + 10, -pond.y * 0.5 + 10);
      sky.painters.get()!.sky.paintWater(w, createRng(`${seed}:water-sky:${phase}`), phase, pond);
      const c = createPainter(makeCanvas(640, 400), { seed: `cast:${phase}` });
      c.ctx.setTransform(CAST_SCALE, 0, 0, CAST_SCALE, 0, 0);
      paintCastPlate(c, createRng(`cast:${phase}`), phase, scene, art);
      const cost = rec.mark();
      out[phase] = { hash: rec.hash, calls: cost.calls, pixels: cost.pixels };
    } finally {
      uninstall();
    }
  }
  return out;
}

/** The overview's visible world at the shots script's viewports (`scripts/shots.ts`). */
const VIEWPORTS = [
  [390, 844],
  [1440, 900],
  [1920, 1080],
] as const;
/** The deckled paper edge round the stage, in world units (as the waterfall's S19 test). */
const EDGE = 24;
const sky = (s: Partial<DaylightState>): DaylightState => ({ ...pinnedState(only('night')), ...s });

describe('the coast daylight (G5)', () => {
  let coast: Record<DayPhase, Plates>;
  let oasis: Record<DayPhase, Plates>;
  beforeAll(() => {
    coast = recordPlates(COAST.sky, COAST.geometry, COAST.light, COAST.art.seed);
    oasis = recordPlates(OASIS.sky, OASIS.geometry, OASIS.light, OASIS.art.seed);
  }, 120_000);

  it('is wired as the scenery’s sky and light, lit from the left, its sea mirroring the sky strongly', () => {
    expect(COAST.sky).toBe(COAST_SKY);
    expect(COAST.light).toBe(COAST_LIGHT_ART);
    expect(COAST.light.sky).toBe(COAST.sky.layout);
    expect(COAST.sky.layout.sunSide).toEqual({ sunrise: -1, sunset: -1 });
    expect(COAST_LIGHT.shadows).toBeTypeOf('function');
    expect(COAST_LIGHT.lights).toBeTypeOf('function');
    expect(COAST.sky.waterAlpha).toBe(COAST_WATER_ALPHA);
    for (const p of PHASES) {
      expect(COAST_WATER_ALPHA[p], p).toBeGreaterThan(WATER_SKY_ALPHA[p]);
      expect(WATER_NEAR[p], p).toBeLessThan(1);
    }
  });

  it('has its own grades: both low glows over the sea where the suns are, no lantern, a readable night (ADR 0301)', () => {
    expect(COAST.light.grades).toBe(COAST_GRADES);
    const g = COAST_GRADES;
    expect(g.sunrise.glowX * 1600).toBeCloseTo(COAST_SKY_LAYOUT.sunriseX, -1);
    expect(g.sunset.glowX * 1600).toBeCloseTo(COAST_SKY_LAYOUT.sunsetX, -1);
    for (const p of ['sunrise', 'sunset'] as const) expect(g[p].glowY * 1000).toBeCloseTo(COAST_SKY_LAYOUT.horizonY, -1);
    for (const p of PHASES) expect(g[p].lantern).toBe(0);
    expect(g.night.amount).toBeLessThanOrEqual(PHASE_GRADES.night.amount);
    expect(g.night.tint[2]).toBeGreaterThan(g.night.tint[0] * 2);
    expect(gradeFor(only('sunset'), g)).toEqual(g.sunset);
  });

  it('keeps the suns and the moon inside the frame at every shots viewport, clear of the deckle', () => {
    for (const [w, h] of VIEWPORTS) {
      const vis = createViewport(w, h, 1, COAST.view.focus).visible;
      const inFrame = (d: { x: number; y: number; r: number }, what: string) => {
        expect(d.x - d.r, `${what} at ${w}×${h}`).toBeGreaterThanOrEqual(vis.x + EDGE);
        expect(d.x + d.r, `${what} at ${w}×${h}`).toBeLessThanOrEqual(vis.x + vis.w - EDGE);
        expect(d.y - d.r, `${what} at ${w}×${h}`).toBeGreaterThanOrEqual(vis.y + EDGE);
      };
      for (const rising of [true, false]) {
        for (let alt = -3; alt <= 16; alt += 0.5) {
          const sun = sunDisc(sky({ sunAltitude: alt, sunRising: rising }), COAST_SKY_LAYOUT);
          if (sun.alpha <= 0.01 || sun.y - sun.r > skylineAt(sun.x)) continue;
          inFrame(sun, `${rising ? 'rising' : 'setting'} sun at ${alt}°`);
        }
      }
      for (let u = 0; u <= 1.0001; u += 0.05) inFrame(moonDisc(sky({ sunAltitude: -20, moonProgress: u }), COAST_SKY_LAYOUT), `moon at ${u.toFixed(2)}`);
    }
    // and at the pinned phases, in open sky
    for (const phase of PHASES) {
      const state = pinnedState(only(phase));
      const sun = sunDisc(state, COAST_SKY_LAYOUT);
      if (sun.alpha > 0) expect(sun.y, `${phase} sun`).toBeLessThan(skylineAt(sun.x));
      const moon = moonDisc(state, COAST_SKY_LAYOUT);
      if (moon.alpha > 0) expect(moon.y + moon.r, `${phase} moon`).toBeLessThan(skylineAt(moon.x));
    }
  });

  it('cuts the sky to the skyline without the temple: up to every column’s edge, never over it', () => {
    const bottom = COAST_SKY_RECT.y + COAST_SKY_RECT.h;
    const outline = plateSky();
    for (const q of outline.slice(2)) {
      expect(q.y, `${q.x}`).toBeLessThan(bottom - 10);
      const hang = q.y - groundAt(q.x);
      expect(hang, `${q.x}`).toBeGreaterThanOrEqual(0);
      expect(hang, `${q.x}`).toBeLessThanOrEqual(q.x > STYLOBATE.x0 && q.x < STYLOBATE.x1 ? 0.51 : 4.01);
    }
    const open = (x: number, y: number) => pointInPolygon({ x, y }, outline) && !TEMPLE_CUT.some((c) => pointInPolygon({ x, y }, c));
    const cols = columnShapes();
    cols.forEach((c, i) => {
      // the cut lies inside the painted shaft, so the sky overlaps its edge a little: no paper between
      for (const q of TEMPLE_CUT[i]!) expect(pointInPolygon(q, c.outline), `column ${i}`).toBe(true);
      const mid = STYLOBATE.y - c.h / 2;
      expect(open(c.x, mid), `column ${i} middle`).toBe(false);
      expect(open(c.x - 9, mid), `left of column ${i}`).toBe(true);
      expect(open(c.x + 9, mid), `right of column ${i}`).toBe(true);
    });
    // between the columns down to the stylobate: the island behind the base takes the sky (the white patch)
    for (let i = 1; i < COLUMNS.length; i++) {
      const x = (COLUMNS[i - 1]!.x + COLUMNS[i]!.x) / 2;
      for (const y of [STYLOBATE.y - 2, STYLOBATE.y - 12, 380]) expect(open(x, y), `${x},${y}`).toBe(true);
    }
    // the architrave keeps its own stone, and the sky runs under it
    expect(open(720, STYLOBATE.y - 101)).toBe(false);
    expect(open(719, STYLOBATE.y - 60)).toBe(true);
  });

  it('scatters the night’s extra stars in open sky, off the pine, the olive and the temple', () => {
    expect(COAST_NIGHT_STARS.length).toBeGreaterThan(100);
    const inEllipse = (s: { x: number; y: number }, e: { x: number; y: number; rx: number; ry: number }) => ((s.x - e.x) / e.rx) ** 2 + ((s.y - e.y) / e.ry) ** 2 < 1;
    for (const s of [...COAST_NIGHT_STARS, ...stars(30, 'stars', COAST_SKY_LAYOUT)]) {
      expect(s.y + s.r * 2, `${s.x},${s.y}`).toBeLessThan(skylineAt(s.x) - 10);
      for (const pad of PINE_PADS) expect(inEllipse(s, { ...pad, rx: pad.rx + 10, ry: pad.ry + 10 }), `${s.x},${s.y}`).toBe(false);
      expect(inEllipse(s, { x: OLIVE.crown.x, y: OLIVE.crown.y, rx: OLIVE.rx, ry: OLIVE.ry }), `${s.x},${s.y}`).toBe(false);
    }
  });

  it('mirrors each phase on the sea: turquoise at noon, pearly at sunrise, apricot to dusky teal at sunset, ink at night', () => {
    const rgb = (c: string) => hexToRgb(c);
    const noon = rgb(COAST_WATER_SKY.midday.near);
    expect(noon.g).toBeGreaterThan(noon.r + 60);
    expect(noon.b).toBeGreaterThan(noon.r + 60);
    const pearl = rgb(COAST_WATER_SKY.sunrise.far);
    expect(Math.min(pearl.r, pearl.g, pearl.b)).toBeGreaterThan(180);
    const fire = rgb(COAST_WATER_SKY.sunset.far);
    expect(fire.r).toBeGreaterThan(fire.b + 80);
    const dusk = rgb(COAST_WATER_SKY.sunset.near);
    expect(dusk.g).toBeGreaterThan(dusk.r);
    expect(dusk.b).toBeGreaterThan(dusk.r);
    for (const c of [COAST_WATER_SKY.night.far, COAST_WATER_SKY.night.near]) {
      const n = rgb(c);
      expect(n.b, c).toBeGreaterThan(n.r + 30);
      expect((n.r + n.g + n.b) / 3, c).toBeLessThan(110);
    }
  });

  it('lights a few of the village’s windows and a lamp by the chapel at night', () => {
    expect(LIT_WINDOWS.length).toBeGreaterThanOrEqual(4);
    expect(LIT_WINDOWS.length).toBeLessThanOrEqual(8);
    const holes = VILLAGE_CUBES.flat().flatMap((c) => c.holes);
    for (const w of LIT_WINDOWS) {
      expect(holes.some((h) => w.x >= h.x && w.x <= h.x + h.w && w.y >= h.y && w.y <= h.y + h.h), `${w.x},${w.y}`).toBe(true);
      expect(VILLAGE.some((v) => w.x > v.x - 12 && w.x < v.x + v.w + 12 && w.y > v.y - 16 && w.y < v.y + v.h + 12), `${w.x},${w.y}`).toBe(true);
    }
    expect(Math.hypot(CHAPEL_LAMP.x - CHAPEL.x, CHAPEL_LAMP.y - CHAPEL.y)).toBeLessThan(16);
  });

  it('keys its sky and light plates by the coast; its grades join its light print', () => {
    const rect = { x: 0, y: 0, w: 10, h: 10 };
    for (const phase of PHASES) {
      expect(skyPlateKey(COAST.id, COAST.art.seed, phase, { w: 1, h: 1 }, rect, { w: 1, h: 1 })).toContain('coast');
      expect(lightPlateKey(COAST.id, 'cast', phase, 1, 1, 'x')).toContain('coast');
    }
    const { grades: _g, ...plain } = COAST_LIGHT_ART;
    expect(castPrint(COAST.geometry, COAST_LIGHT_ART)).not.toBe(castPrint(COAST.geometry, plain));
  });

  // quantised hashes from a fresh process (paint caches warm up across runs)
  it('is deterministic: the same plates every time (recording hash pins)', () => {
    const hashes = Object.fromEntries(PHASES.map((p) => [p, coast[p].hash]));
    expect(hashes).toEqual(PINS);
  });

  it('paints its plates at about the oasis’s cost', () => {
    let ours = 0;
    let theirs = 0;
    for (const p of PHASES) {
      ours += coast[p].calls + coast[p].pixels / 1000;
      theirs += oasis[p].calls + oasis[p].pixels / 1000;
    }
    expect(ours).toBeLessThan(theirs * 1.5);
  });
});

const PINS: Record<DayPhase, string> = { sunrise: '6513a284', midday: 'b07c9815', sunset: '716c4a7f', night: 'c5611c3f' };
