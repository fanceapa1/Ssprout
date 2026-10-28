import { describe, expect, it } from 'vitest';
import type { DaylightState } from '../../ambience/daylight';
import { moonDisc, stars, sunDisc } from '../../ambience/sky-layout';
import { isCompatible } from '../../core/placement';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { allSpecies } from '../../plants/registry';
import { HABITATS, SIZE_CLASSES } from '../../plants/types';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt } from '../../render/viewport';
import type { Slot } from '../../scene/geometry';
import { FAR_SCALE, NEAR_SCALE, PLANT_SIZES, perspectiveScale, plantScale } from '../../scene/slots';
import { WATERFALL, waterfallAvailable } from '.';
import { FALLS, POOL, ROCKS, STREAM, TRAIL, waterfallScene } from './geometry';
import { CLIFF, CROWN_SCALE, LEDGES, openSky, skylineAt, WATERFALL_HABITAT_WORDS, WATERFALL_SKY_LAYOUT } from './layout';

const { slots } = waterfallScene;
const byHabitat = (h: string) => slots.filter((s) => s.habitat === h);
const onCliff = (s: Slot) => s.id.startsWith('ledge-') || (s.id.startsWith('cliff-') && s.y < 400);

function edgeDistance(p: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

const inWater = (p: Pt) => pointInPolygon(p, POOL) || waterfallScene.streams.some((st) => pointInPolygon(p, st));
const waterEdge = (p: Pt) => Math.min(edgeDistance(p, POOL), edgeDistance(p, STREAM));

/** The box of the largest plant a slot takes, as the plant system draws it (1.25×, anchor 0.5, 0.95). */
function box(s: Slot) {
  const k = plantScale(s);
  const w = PLANT_SIZES[s.maxSize].w * k;
  const h = PLANT_SIZES[s.maxSize].h * k;
  return { x: s.x - w / 2, y: s.y - 0.95 * h, w, h };
}

function overlapArea(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

/** A daylight state carrying only what the sky layout reads. */
const sky = (alt: number, rising: boolean, moon = 0) =>
  ({ sunAltitude: alt, sunRising: rising, moonProgress: moon, weights: { sunrise: 1, sunset: 1, midday: 0, night: 1 } }) as unknown as DaylightState;

describe('the waterfall scenery', () => {
  it('is hidden unless asked for with ?dev&scenery=waterfall', () => {
    expect(waterfallAvailable(new URLSearchParams())).toBe(false);
    expect(waterfallAvailable(new URLSearchParams('scenery=waterfall'))).toBe(false);
    expect(waterfallAvailable(new URLSearchParams('dev&scenery=japanese-garden'))).toBe(false);
    expect(waterfallAvailable(new URLSearchParams('dev&scenery=waterfall'))).toBe(true);
  });

  it('is consistent with itself and has no building, lantern or eave', () => {
    expect(WATERFALL.id).toBe('waterfall');
    expect(WATERFALL.art.scenery).toBe('waterfall');
    expect(WATERFALL.art.scene).toBe(WATERFALL.geometry);
    expect(WATERFALL.light.sky).toBe(WATERFALL.sky.layout);
    expect(waterfallScene.structure).toBeNull();
    expect(waterfallScene.lights).toEqual([]);
    expect(waterfallScene.eave).toBeNull();
    expect(waterfallScene.falls).toBe(FALLS);
    expect(waterfallScene.streams).toEqual([STREAM]);
  });

  it('paints its rock, water and placeholder steps back to front, and only the asked-for elements', () => {
    const steps = WATERFALL.art.steps(WATERFALL.art);
    // the water over the rock (the falls over the cliff and the pool), the stepping stones over the water
    expect(steps.map((s) => s.name)).toEqual(['sky', 'far-ridge', 'banks', 'gorge', 'cliff', 'buttress', 'ledges', 'pool', 'stream', 'falls', 'stones']);
    expect(WATERFALL.art.steps(WATERFALL.art, ['water']).map((s) => s.name)).toEqual(['pool', 'stream']);
    expect(WATERFALL.art.steps(WATERFALL.art, ['falls']).map((s) => s.name)).toEqual(['falls']);
  });

  it('records a habitat word for every habitat (for the planting sheet, S5)', () => {
    for (const h of HABITATS) expect(WATERFALL_HABITAT_WORDS[h], h).toMatch(/\w/);
  });
});

describe('waterfall composition', () => {
  it('drops the falls left of centre, off a lip just under the skyline notch, into the pool', () => {
    const b = bounds(FALLS.outline);
    expect(b.x + b.w / 2).toBeLessThan(WORLD_W * 0.45);
    expect(b.x + b.w / 2).toBeGreaterThan(WORLD_W * 0.25);
    for (const q of FALLS.lip) expect(q.y - skylineAt(q.x), 'the upper gorge shows behind the lip').toBeGreaterThanOrEqual(15);
    for (const q of FALLS.lip) expect(q.y - skylineAt(q.x), 'the lip is at the notch').toBeLessThanOrEqual(40);
    expect(pointInPolygon(FALLS.foot, POOL)).toBe(true);
  });

  it('opens the pool from the cliff foot and leads the stream out of it toward the viewer', () => {
    const pb = bounds(POOL);
    expect(Math.abs(waterfallScene.waterline - pb.y)).toBeLessThanOrEqual(4);
    expect(pointInPolygon(STREAM[0]!, POOL) || edgeDistance(STREAM[0]!, POOL) < 30).toBe(true);
    expect(bounds(STREAM).y + bounds(STREAM).h).toBeGreaterThanOrEqual(WORLD_H);
  });

  it('runs the trail from the bottom up to the pool, shrinking with distance', () => {
    expect(TRAIL[0]!.y).toBeGreaterThan(940);
    for (let i = 1; i < TRAIL.length; i++) {
      expect(TRAIL[i]!.y).toBeLessThan(TRAIL[i - 1]!.y);
      expect(TRAIL[i]!.rx).toBeLessThan(TRAIL[i - 1]!.rx);
    }
    expect(edgeDistance(TRAIL[TRAIL.length - 1]!, POOL)).toBeLessThan(40);
    expect(WATERFALL.view.pathOut[0]).toEqual({ x: TRAIL[0]!.x, y: TRAIL[0]!.y + TRAIL[0]!.ry });
  });

  it('keeps the falls, the pool and the setting sun in the portrait crop', () => {
    const { focus } = WATERFALL.view;
    const crop = { x0: focus.x - MIN_VISIBLE_W / 2, x1: focus.x + MIN_VISIBLE_W / 2 };
    const f = bounds(FALLS.outline);
    expect(f.x).toBeGreaterThanOrEqual(crop.x0);
    expect(f.x + f.w).toBeLessThanOrEqual(crop.x1);
    expect(pointInPolygon(focus, POOL) || focus.y < bounds(POOL).y).toBe(true);
    expect(WATERFALL_SKY_LAYOUT.sunsetX).toBeLessThan(crop.x1);
  });

  it('keeps boulders off the falls with unique ids, some of them perches', () => {
    expect(new Set(ROCKS.map((r) => r.id)).size).toBe(ROCKS.length);
    expect(ROCKS.filter((r) => r.perch).length).toBeGreaterThanOrEqual(3);
    for (const r of ROCKS) expect(pointInPolygon({ x: r.x, y: r.y - r.h / 2 }, FALLS.outline), r.id).toBe(false);
  });
});

describe('waterfall slots', () => {
  it('has 45–60 slots with unique, place-prefixed ids', () => {
    expect(slots.length).toBeGreaterThanOrEqual(45);
    expect(slots.length).toBeLessThanOrEqual(60);
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
    for (const s of slots) expect(s.id).toMatch(/^(pool|ledge|stream|bank|trail|cliff)-\d+$/);
  });

  it('uses known habitats and sizes and offers every habitat', () => {
    for (const s of slots) {
      expect(HABITATS).toContain(s.habitat);
      expect(SIZE_CLASSES).toContain(s.maxSize);
    }
    for (const h of HABITATS) expect(byHabitat(h).length, h).toBeGreaterThanOrEqual(4);
  });

  it('keeps every slot, and the 1.25× box of its largest plant, inside the world', () => {
    for (const s of slots) {
      const b = box(s);
      expect(s.x >= 0 && s.x <= WORLD_W && s.y <= WORLD_H, s.id).toBe(true);
      expect(b.y, s.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps slots out of the sky and off the falls', () => {
    for (const s of slots) {
      expect(s.y, `${s.id} below the skyline`).toBeGreaterThan(skylineAt(s.x) + 5);
      expect(pointInPolygon(s, openSky()), s.id).toBe(false);
      expect(pointInPolygon(s, FALLS.outline), s.id).toBe(false);
      expect(edgeDistance(s, FALLS.outline), s.id).toBeGreaterThanOrEqual(30);
    }
  });

  it('never lets a plant hide much of the falls: at most a fifth of the sheet', () => {
    const f = bounds(FALLS.outline);
    for (const s of slots) expect(overlapArea(box(s), f) / (f.w * f.h), s.id).toBeLessThanOrEqual(0.2);
  });

  it('puts water slots on the water, clear of its edge and of the foam at the foot', () => {
    const water = byHabitat('water');
    for (const s of water) {
      expect(inWater(s), s.id).toBe(true);
      expect(waterEdge(s), s.id).toBeGreaterThanOrEqual(30);
      expect(Math.hypot(s.x - FALLS.foot.x, s.y - FALLS.foot.y), s.id).toBeGreaterThanOrEqual(80);
      expect(s.id, s.id).toMatch(/^pool-/);
    }
  });

  it('keeps land slots off the water and shore slots within reach of it', () => {
    for (const s of slots.filter((q) => q.habitat !== 'water')) expect(inWater(s), s.id).toBe(false);
    for (const s of byHabitat('shore')) expect(waterEdge(s), s.id).toBeLessThanOrEqual(45);
  });

  it('puts ledge slots on a ledge, crown slots under the skyline, and ground slots off the cliff', () => {
    for (const s of slots) {
      if (s.id.startsWith('ledge-')) {
        const on = LEDGES.find((l) => s.x >= l.edge[0].x && s.x <= l.edge[1].x && Math.abs(s.y - (l.edge[0].y + ((l.edge[1].y - l.edge[0].y) * (s.x - l.edge[0].x)) / (l.edge[1].x - l.edge[0].x))) <= 6);
        expect(on, s.id).toBeDefined();
        expect(s.scale, s.id).toBe(on!.scale);
        expect(s.habitat, s.id).toBe('rock');
      } else if (onCliff(s)) {
        expect(s.y - skylineAt(s.x), s.id).toBeLessThanOrEqual(30);
        expect(s.scale, s.id).toBe(CROWN_SCALE);
      } else {
        expect(pointInPolygon(s, CLIFF), `${s.id} off the cliff`).toBe(false);
        expect(s.scale, s.id).toBe(perspectiveScale(s.y));
      }
    }
  });

  it('gives cliff slots a scale for their depth: within the ground range, smaller higher up', () => {
    for (const s of slots) {
      expect(s.scale, s.id).toBeGreaterThanOrEqual(FAR_SCALE);
      expect(s.scale, s.id).toBeLessThanOrEqual(NEAR_SCALE);
    }
    const scales = LEDGES.filter((l) => l.id.startsWith('left')).map((l) => l.scale);
    expect(scales).toEqual([...scales].sort((a, b) => a - b));
    expect(CROWN_SCALE).toBeLessThan(Math.min(...LEDGES.map((l) => l.scale)));
    // the cliff stands at the pool's back edge: no ledge is nearer than its foot
    for (const l of LEDGES) expect(l.scale).toBeLessThanOrEqual(perspectiveScale(waterfallScene.waterline));
  });

  it('never plants on a stepping stone or inside a boulder', () => {
    for (const s of slots) {
      for (const st of TRAIL) {
        const d = ((s.x - st.x) / (st.rx + 24)) ** 2 + ((s.y - st.y) / (st.ry + 10)) ** 2;
        expect(d, `${s.id} on the stone at ${st.x},${st.y}`).toBeGreaterThan(1);
      }
      for (const r of ROCKS) {
        const d = ((s.x - r.x) / (r.w * 0.45)) ** 2 + ((s.y - (r.y - r.h * 0.3)) / (r.h * 0.4)) ** 2;
        expect(d, `${s.id} inside ${r.id}`).toBeGreaterThan(1);
      }
    }
  });

  it('puts trail slots beside the stepping stones', () => {
    for (const s of byHabitat('path')) {
      expect(Math.min(...TRAIL.map((st) => Math.hypot(s.x - st.x, s.y - st.y))), s.id).toBeLessThanOrEqual(130);
    }
  });
});

describe('every species has somewhere to grow by the waterfall', () => {
  it('has a compatible slot for every species', () => {
    const homeless = allSpecies()
      .filter((sp) => !slots.some((s) => isCompatible(sp, s)))
      .map((sp) => sp.id);
    expect(homeless).toEqual([]);
  });

  it('gives the lotus at least two large pool slots', () => {
    const lotus = allSpecies().find((sp) => sp.id === 'lotus')!;
    const spots = slots.filter((s) => isCompatible(lotus, s));
    expect(spots.length).toBeGreaterThanOrEqual(2);
    for (const s of spots) {
      expect(s.maxSize).toBe('large');
      expect(pointInPolygon(s, POOL), s.id).toBe(true);
    }
  });
});

describe('waterfall spacing at the garden scale (1.25×)', () => {
  const footprint = (s: Slot) => {
    const b = box(s);
    return { x0: s.x - b.w * 0.3, x1: s.x + b.w * 0.3 };
  };

  it('keeps slots apart from each other', () => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!;
        const b = slots[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}–${b.id}`).toBeGreaterThanOrEqual(28);
      }
    }
  });

  it('keeps neighbours readable: plants at the same depth overlap by at most half their footprint', () => {
    const open = slots.filter((s) => s.maxSize !== 'tree');
    for (let i = 0; i < open.length; i++) {
      for (let j = i + 1; j < open.length; j++) {
        const a = open[i]!;
        const b = open[j]!;
        if (Math.abs(a.y - b.y) > 40) continue;
        const fa = footprint(a);
        const fb = footprint(b);
        const ov = Math.max(0, Math.min(fa.x1, fb.x1) - Math.max(fa.x0, fb.x0));
        expect(ov / Math.min(fa.x1 - fa.x0, fb.x1 - fb.x0), `${a.id}–${b.id}`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('never stands a cliff plant over the base of another one higher up the cliff', () => {
    const cliff = slots.filter(onCliff);
    for (const a of cliff) {
      const b = box(a);
      for (const o of cliff) {
        if (o === a || o.y >= a.y) continue;
        const covered = o.x >= b.x && o.x <= b.x + b.w && o.y >= b.y && o.y <= b.y + b.h;
        expect(covered, `${a.id} hides ${o.id}`).toBe(false);
      }
    }
  });

  it('spaces the trees so full-size crowns do not collide, and keeps them off the ledges', () => {
    const trees = slots.filter((s) => s.maxSize === 'tree');
    expect(trees.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const a = trees[i]!;
        const b = trees[j]!;
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((PLANT_SIZES.tree.w * (plantScale(a) + plantScale(b))) / 2);
      }
      const crown = box(trees[i]!);
      for (const s of slots.filter(onCliff)) {
        expect(s.x >= crown.x && s.x <= crown.x + crown.w && s.y >= crown.y, `${trees[i]!.id} hides ${s.id}`).toBe(false);
      }
    }
  });
});

describe('the waterfall sky', () => {
  const open = openSky();
  const inSky = (p: Pt, r = 0) => [p, { x: p.x, y: p.y + r }, { x: p.x - r, y: p.y }, { x: p.x + r, y: p.y }].every((q) => pointInPolygon(q, open));

  it('raises and sets the sun in open sky, from behind the far ridge', () => {
    for (const rising of [true, false]) {
      for (let alt = 8; alt <= 16; alt++) {
        const d = sunDisc(sky(alt, rising), WATERFALL_SKY_LAYOUT);
        expect(inSky(d, d.r), `${rising ? 'rising' : 'setting'} at ${alt}°`).toBe(true);
      }
      const low = sunDisc(sky(-3, rising), WATERFALL_SKY_LAYOUT);
      expect(pointInPolygon(low, open), 'hidden below the ridge when it first shows').toBe(false);
    }
  });

  it('keeps the sun clear of the tree slots’ crowns', () => {
    const crowns = slots.filter((s) => s.maxSize === 'tree').map(box);
    for (const rising of [true, false]) {
      for (let alt = 0; alt <= 16; alt += 2) {
        const d = sunDisc(sky(alt, rising), WATERFALL_SKY_LAYOUT);
        for (const c of crowns) expect(d.x + d.r < c.x || d.x - d.r > c.x + c.w, `sun at ${alt}°`).toBe(true);
      }
    }
  });

  it('arcs the moon through open sky', () => {
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const d = moonDisc(sky(-20, false, u), WATERFALL_SKY_LAYOUT);
      expect(inSky(d, d.r), `moon at ${u.toFixed(2)}`).toBe(true);
    }
  });

  it('scatters the stars in open sky only', () => {
    for (const seed of ['stars', 'a', 'b', 'c']) {
      for (const s of stars(40, seed, WATERFALL_SKY_LAYOUT)) expect(inSky(s, 6), `${seed} ${s.x},${s.y}`).toBe(true);
    }
  });

  it('keeps the sky plates’ band over the sky: the skyline (+40) is above its lower edge', () => {
    const r = WATERFALL.sky.rect;
    for (const q of WATERFALL.sky.shape(40)) expect(q.y, `${q.x}`).toBeLessThan(r.y + r.h);
    expect(waterfallScene.skyBand.bottom).toBeLessThan(waterfallScene.waterline);
  });
});
