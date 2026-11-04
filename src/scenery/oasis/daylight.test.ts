/**
 * The oasis's daylight (O5, ADR 0301): wired as the scenery's sky and light with its own grades,
 * the washes clear of the plate's lower edge, the night's stars in open sky, the basin plate
 * turquoise in every phase, plate keys carrying the scenery, and a plate cost in line with the
 * waterfall's.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CAST_SCALE, castPrint, lightPlateKey, paintCastPlate, type LightArt } from '../../ambience/cast';
import { only, PHASES, pinnedState, type DayPhase } from '../../ambience/daylight';
import { moonDisc, sunDisc } from '../../ambience/sky-layout';
import { gradeFor, PHASE_GRADES } from '../../ambience/timeofday';
import { createRng } from '../../core/rng';
import { createPainter, hexToRgb, makeCanvas } from '../../paint';
import { bounds } from '../../paint/geometry';
import type { Rect } from '../../render/viewport';
import type { SceneGeometry } from '../../scene/geometry';
import { PaintRecorder } from '../../scene/paint-record';
import { SKY_SCALE } from '../../scene/paint-sky';
import { skyPlateKey } from '../../scene/sky-light';
import type { ScenerySky } from '../types';
import { WATERFALL } from '../waterfall';
import { OASIS } from '.';
import { OASIS_SKY_LAYOUT, skylineAt } from './layout';
import { OASIS_GRADES, OASIS_LIGHT_ART } from './light';
import { MILKY_WAY, OASIS_NIGHT_STARS, OASIS_SKY, OASIS_SKY_RECT, OASIS_WATER_SKY, plateSky } from './sky';

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
      sky.paint(s, createRng(`${seed}:sky:${phase}`), phase);
      const w = createPainter(makeCanvas(Math.ceil(pond.w * 0.5) + 20, Math.ceil(pond.h * 0.5) + 20), { seed: `${seed}:water-sky:${phase}` });
      w.ctx.setTransform(0.5, 0, 0, 0.5, -pond.x * 0.5 + 10, -pond.y * 0.5 + 10);
      sky.paintWater(w, createRng(`${seed}:water-sky:${phase}`), phase, pond);
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

describe('the oasis daylight (O5)', () => {
  let oasis: Record<DayPhase, Plates>;
  let waterfall: Record<DayPhase, Plates>;
  beforeAll(() => {
    oasis = recordPlates(OASIS.sky, OASIS.geometry, OASIS.light, OASIS.art.seed);
    waterfall = recordPlates(WATERFALL.sky, WATERFALL.geometry, WATERFALL.light, WATERFALL.art.seed);
  }, 120_000);

  it('is wired as the scenery’s sky and light, on one sky layout with the sun on the right', () => {
    expect(OASIS.sky).toBe(OASIS_SKY);
    expect(OASIS.light).toBe(OASIS_LIGHT_ART);
    expect(OASIS.light.sky).toBe(OASIS_SKY_LAYOUT);
    expect(OASIS.sky.layout.sunSide).toEqual({ sunrise: 1, sunset: 1 });
    expect(OASIS.light.shadows).toBeTypeOf('function');
    expect(OASIS.light.lights).toBeTypeOf('function');
  });

  it('has its own grades: warmer and more golden by day, readable at night (ADR 0301)', () => {
    expect(OASIS.light.grades).toBe(OASIS_GRADES);
    const g = OASIS_GRADES;
    // midday: a thin gold rather than bare paper (blue taken out more than red)
    expect(g.midday.amount).toBeGreaterThan(PHASE_GRADES.midday.amount);
    expect(g.midday.tint[0] - g.midday.tint[2]).toBeGreaterThan(PHASE_GRADES.midday.tint[0] - PHASE_GRADES.midday.tint[2]);
    // sunset: deeper amber, glowing over the notch on the right, not on the left
    expect(g.sunset.amount).toBeGreaterThanOrEqual(PHASE_GRADES.sunset.amount);
    expect(g.sunset.tint[0] - g.sunset.tint[2]).toBeGreaterThan(PHASE_GRADES.sunset.tint[0] - PHASE_GRADES.sunset.tint[2]);
    expect(g.sunset.glowX * 1600).toBeCloseTo(OASIS_SKY_LAYOUT.sunsetX, -2);
    expect(g.sunrise.glowX * 1600).toBeCloseTo(OASIS_SKY_LAYOUT.sunriseX, -2);
    // night no heavier than the garden's, and no lantern anywhere (the oasis has no lights)
    expect(g.night.amount).toBeLessThanOrEqual(PHASE_GRADES.night.amount);
    for (const p of PHASES) expect(g[p].lantern).toBe(0);
    // the blend reads them, and other sceneries keep the shared grades
    expect(gradeFor(only('sunset'), g)).toEqual(g.sunset);
    expect(gradeFor(only('sunset'))).toEqual(PHASE_GRADES.sunset);
  });

  it('keeps the sun’s centre and the moon’s whole disc in the open sky', () => {
    for (const phase of PHASES) {
      const state = pinnedState(only(phase));
      const sun = sunDisc(state, OASIS_SKY_LAYOUT);
      if (sun.alpha > 0) expect(sun.y, `${phase} sun`).toBeLessThan(skylineAt(sun.x));
      const moon = moonDisc(state, OASIS_SKY_LAYOUT);
      if (moon.alpha > 0) expect(moon.y + moon.r, `${phase} moon`).toBeLessThan(skylineAt(moon.x));
    }
  });

  it('scatters the night’s dense stars in open sky, on the plate', () => {
    expect(OASIS_NIGHT_STARS.length).toBeGreaterThan(150);
    for (const s of OASIS_NIGHT_STARS) {
      expect(s.y + s.r * 2, `${s.x}`).toBeLessThan(skylineAt(s.x) - 10);
      expect(s.y).toBeGreaterThan(OASIS_SKY_RECT.y);
    }
    expect(MILKY_WAY.y1).toBeLessThan(skylineAt(MILKY_WAY.x1));
  });

  it('never lets a sky wash reach the plate’s lower edge (ADR 0206), and hangs only a little on the rock', () => {
    const bottom = OASIS_SKY_RECT.y + OASIS_SKY_RECT.h;
    const line = plateSky().slice(2);
    for (const q of line) {
      expect(q.y, `${q.x}`).toBeLessThan(bottom - 10);
      expect(q.y - skylineAt(q.x), `${q.x}`).toBeLessThanOrEqual(44.01);
      // over the bluff and the ksar the hang is short, so the pale pisé takes no sky
      if (q.x < 880) expect(q.y - skylineAt(q.x), `${q.x}`).toBeLessThanOrEqual(4.01);
    }
  });

  it('keeps the basin plate turquoise under every sky (devlog 110)', () => {
    for (const p of PHASES) {
      for (const c of [OASIS_WATER_SKY[p].far, OASIS_WATER_SKY[p].near]) {
        const { r, g, b } = hexToRgb(c);
        expect(b, `${p} ${c}`).toBeGreaterThan(r + 30);
        if (p !== 'night') expect(g, `${p} ${c}`).toBeGreaterThan(r + 30);
      }
    }
  });

  it('keys its sky and light plates by the oasis; its grades join only its light print', () => {
    const rect = { x: 0, y: 0, w: 10, h: 10 };
    for (const phase of PHASES) {
      expect(skyPlateKey(OASIS.id, OASIS.art.seed, phase, { w: 1, h: 1 }, rect, { w: 1, h: 1 })).toContain('oasis');
      expect(lightPlateKey(OASIS.id, 'cast', phase, 1, 1, 'x')).toContain('oasis');
    }
    const { grades: _g, ...plain } = OASIS_LIGHT_ART;
    expect(castPrint(OASIS.geometry, OASIS_LIGHT_ART)).not.toBe(castPrint(OASIS.geometry, plain));
    expect(castPrint(WATERFALL.geometry, WATERFALL.light)).toBe(castPrint(WATERFALL.geometry, { ...WATERFALL.light, grades: undefined }));
  });

  // quantised hashes from a fresh process (paint caches warm up across runs)
  it('is deterministic: the same plates every time (recording hash pins)', () => {
    const hashes = Object.fromEntries(PHASES.map((p) => [p, oasis[p].hash]));
    expect(hashes).toEqual(PINS);
  });

  it('paints its plates at about the waterfall’s cost', () => {
    let ours = 0;
    let theirs = 0;
    for (const p of PHASES) {
      ours += oasis[p].calls + oasis[p].pixels / 1000;
      theirs += waterfall[p].calls + waterfall[p].pixels / 1000;
    }
    expect(ours).toBeLessThan(theirs * 1.5);
  });
});

const PINS: Record<DayPhase, string> = { sunrise: '8fc38485', midday: '82aa127a', sunset: 'f1dd1654', night: 'cecaf68e' };
