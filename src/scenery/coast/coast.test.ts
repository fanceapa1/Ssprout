import { describe, expect, it } from 'vitest';
import type { DaylightState } from '../../ambience/daylight';
import { moonDisc, stars, sunDisc, sunSide } from '../../ambience/sky-layout';
import { exportState, importState, validateState } from '../../core/persistence';
import { createDefaultState } from '../../core/state';
import { makePlant, T0 } from '../../core/testing';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { floraOf } from '../../plants/flora';
import { allSpecies } from '../../plants/registry';
import { HABITATS, SIZE_CLASSES } from '../../plants/types';
import { MIN_VISIBLE_W, WORLD_H, WORLD_W, type Pt } from '../../render/viewport';
import type { Slot } from '../../scene/geometry';
import { FAR_SCALE, NEAR_SCALE, PLANT_SIZES, perspectiveScale, plantScale } from '../../scene/slots';
import { faunaTable } from '../fauna';
import { getScenery } from '../registry';
import { COAST, COAST_ELEMENTS } from '.';
import { coastScene, POOL_WATER, SEA_WATER } from './geometry';
import {
  BEACH, CAIQUE, COAST_HABITAT_WORDS, COAST_SKY_LAYOUT, COLUMNS, copingAt, LAND, LIFT, OLIVE, openSky, PATH, PROMONTORY, SHELF, SHORE_EDGE,
  silhouetteAt, skylineAt, SPLASH_ROCKS, STYLOBATE, TEMPLE_SHAPES, terraceScale, WALL_TERRACE, WALLS, WATERLINE_EDGE,
} from './layout';
import { coastSteps } from './painters';
import { SLOT_TERRACE } from './slots';

const { slots } = coastScene;
const byHabitat = (h: string) => slots.filter((s) => s.habitat === h);
const prefixed = (p: string) => slots.filter((s) => s.id.startsWith(`${p}-`));

function edgeDistance(p: Pt, poly: readonly Pt[], closed = true): number {
  let best = Infinity;
  const n = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

const inSea = (p: Pt) => pointInPolygon(p, SEA_WATER);
const inPool = (p: Pt) => POOL_WATER.some((w) => pointInPolygon(p, w));
const pathDistance = (p: Pt) => edgeDistance(p, PATH, false);

/** The box of the largest plant a slot takes, as the plant system draws it (1.25×, anchor 0.5, 0.95). */
function box(s: Slot) {
  const k = plantScale(s);
  const w = PLANT_SIZES[s.maxSize].w * k;
  const h = PLANT_SIZES[s.maxSize].h * k;
  return { x: s.x - w / 2, y: s.y - 0.95 * h, w, h };
}
const covers = (front: Slot, back: Slot) => {
  const b = box(front);
  return back.y < front.y && back.x >= b.x && back.x <= b.x + b.w && back.y >= b.y;
};
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A daylight state carrying only what the sky layout reads. */
const sky = (alt: number, rising: boolean, moon = 0) =>
  ({ sunAltitude: alt, sunRising: rising, moonProgress: moon, weights: { sunrise: 1, sunset: 1, midday: 0, night: 1 } }) as unknown as DaylightState;

const crop = { x0: COAST.view.focus.x - MIN_VISIBLE_W / 2, x1: COAST.view.focus.x + MIN_VISIBLE_W / 2 };
const inCrop = (x: number, margin = 0) => x >= crop.x0 + margin && x <= crop.x1 - margin;
const temple = bounds(TEMPLE_SHAPES.flat());

describe('the coast scenery', () => {
  it('is offered only with ?dev&scenery=coast', () => {
    for (const q of ['', 'dev', 'scenery=coast', 'dev&scenery=oasis']) expect(COAST.available(new URLSearchParams(q)), q).toBe(false);
    expect(COAST.available(new URLSearchParams('dev&scenery=coast'))).toBe(true);
  });

  it('is consistent with itself, has no building, lantern, eave, falls, streams or motion yet', () => {
    expect(COAST.id).toBe('coast');
    expect(COAST.art.scenery).toBe('coast');
    expect(COAST.art.scene).toBe(COAST.geometry);
    expect(COAST.light.sky).toBe(COAST.sky.layout);
    expect(COAST.painters).toBe(COAST.art.painters);
    expect(COAST.sky.painters).toBe(COAST.painters);
    expect(coastScene.structure).toBeNull();
    expect(coastScene.lights).toEqual([]);
    expect(coastScene.eave).toBeNull();
    expect(coastScene.falls).toBeNull();
    expect(coastScene.streams).toEqual([]);
    expect(coastScene.pond).toBe(SEA_WATER);
    expect(COAST.motion).toBeUndefined();
    expect(COAST.sound).toBe('coast');
    expect(COAST.blurb.length).toBeLessThanOrEqual(110);
  });

  it('paints its placeholder steps by element, back to front, and only the asked-for elements', () => {
    const names = coastSteps(COAST.art).map((s) => s.name);
    expect(names).toEqual(Object.values(COAST_ELEMENTS).flat());
    expect(names).toEqual(['far-hill', 'sea', 'caique', 'village', 'promontory', 'temple', 'shore', 'beach', 'pools', 'land', 'walls', 'beds', 'cliff-foot', 'shore-rocks', 'maquis', 'olive', 'pine', 'margins']);
    expect(coastSteps(COAST.art, ['rock', 'trees']).map((s) => s.name)).toEqual(['village', 'promontory', 'temple', 'maquis', 'olive', 'pine']);
  });

  it('records a habitat word for every habitat', () => {
    for (const h of HABITATS) expect(COAST_HABITAT_WORDS[h], h).toMatch(/\w/);
    expect(COAST.habitatWords).toBe(COAST_HABITAT_WORDS);
  });

  it('leaves the garden by the gravel path, nearest first, from the bottom edge up the terraces', () => {
    expect(COAST.view.pathOut).toBe(PATH);
    expect(PATH[0]!.y).toBe(WORLD_H);
    for (let i = 1; i < PATH.length; i++) expect(PATH[i]!.y).toBeLessThan(PATH[i - 1]!.y);
    for (const q of PATH.slice(1)) expect(pointInPolygon(q, LAND), `${q.x},${q.y}`).toBe(true);
  });
});

describe('coast framing (ADR 0360)', () => {
  it('holds the temple, open sea, the sea edge and terrace beds in the 600-wide portrait crop', () => {
    expect(temple.x).toBeGreaterThanOrEqual(crop.x0 + 20);
    expect(temple.x + temple.w).toBeLessThanOrEqual(crop.x1 - 20);
    // open sea across at least a third of the crop at the caique's depth
    let sea = 0;
    for (let x = crop.x0; x <= crop.x1; x += 2) if (inSea({ x, y: 600 })) sea += 2;
    expect(sea).toBeGreaterThanOrEqual(MIN_VISIBLE_W / 3);
    // the sea edge: water, splash rocks, beach and a pool slot, and terrace beds on all three terraces
    for (const prefix of ['shallows', 'splash', 'beach', 'pool']) expect(prefixed(prefix).some((s) => inCrop(s.x, 30)), prefix).toBe(true);
    for (const t of ['top', 'middle', 'lower'] as const) {
      expect(slots.some((s) => s.habitat === 'meadow' && SLOT_TERRACE.get(s.id) === t && inCrop(s.x, 30)), t).toBe(true);
    }
  });

  it('keeps the temple clear of the top edge with sky above it on a 16:9 screen, and the low suns in the crop', () => {
    const top = Math.max(0, Math.min(100, COAST.view.focus.y - 450));
    expect(temple.y - top).toBeGreaterThanOrEqual(150);
    for (const x of [COAST_SKY_LAYOUT.sunsetX, COAST_SKY_LAYOUT.sunriseX]) expect(inCrop(x, 30), `${x}`).toBe(true);
  });

  it('breaks the shoreline: it juts out and cuts back in, and is no straight line', () => {
    let turns = 0;
    for (let i = 2; i < SHORE_EDGE.length; i++) {
      const d0 = SHORE_EDGE[i - 1]!.x - SHORE_EDGE[i - 2]!.x;
      const d1 = SHORE_EDGE[i]!.x - SHORE_EDGE[i - 1]!.x;
      if (d0 * d1 < 0) turns++;
    }
    expect(turns).toBeGreaterThanOrEqual(4);
    const a = SHORE_EDGE[0]!;
    const b = SHORE_EDGE[SHORE_EDGE.length - 1]!;
    const off = Math.max(...SHORE_EDGE.map((q) => Math.abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y)));
    expect(off).toBeGreaterThanOrEqual(40);
  });

  it('lays the land, the beach and the shelf against the sea without gaps', () => {
    for (const q of SHORE_EDGE.slice(1, -2)) expect(edgeDistance(q, SEA_WATER), `${q.x},${q.y}`).toBeLessThan(1);
    for (const q of WATERLINE_EDGE) expect(edgeDistance(q, BEACH)).toBeLessThan(1);
    expect(pointInPolygon({ x: OLIVE.base.x, y: OLIVE.base.y }, LAND)).toBe(true);
    expect(inSea(CAIQUE)).toBe(true);
    for (const r of SPLASH_ROCKS.slice(0, 3)) expect(inSea(r), `${r.x}`).toBe(true);
    expect(bounds(SHELF).y + bounds(SHELF).h).toBeGreaterThanOrEqual(WORLD_H);
  });
});

describe('coast slots', () => {
  it('has 45–56 slots with unique, place-prefixed ids (SPEC §3)', () => {
    expect(slots.length).toBeGreaterThanOrEqual(45);
    expect(slots.length).toBeLessThanOrEqual(56);
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
    for (const s of slots) expect(s.id).toMatch(/^(shallows|pool|beach|top|mid|low|path|scrub|wall|crack|splash|shelf)-\d+$/);
  });

  it('uses known habitats and sizes and offers every habitat (at least four slots each) and every size', () => {
    for (const s of slots) {
      expect(HABITATS).toContain(s.habitat);
      expect(SIZE_CLASSES).toContain(s.maxSize);
    }
    for (const h of HABITATS) expect(byHabitat(h).length, h).toBeGreaterThanOrEqual(4);
    for (const z of SIZE_CLASSES) expect(slots.filter((s) => s.maxSize === z).length, z).toBeGreaterThanOrEqual(2);
  });

  it('gives each terrace beds, and the walls slots on their tops and in their faces', () => {
    for (const t of ['top', 'middle', 'lower'] as const) expect(byHabitat('meadow').filter((s) => SLOT_TERRACE.get(s.id) === t).length, t).toBeGreaterThanOrEqual(3);
    expect(prefixed('wall').length).toBeGreaterThanOrEqual(3);
    expect(prefixed('crack').length).toBeGreaterThanOrEqual(2);
    expect(prefixed('splash').length).toBeGreaterThanOrEqual(3);
  });

  it('has two tree slots, one in the beds and one in the scrub, for the olive and a showpiece', () => {
    const trees = slots.filter((s) => s.maxSize === 'tree');
    expect(trees.map((s) => s.habitat).sort()).toEqual(['back', 'meadow']);
  });

  it('keeps every slot, and the 1.25× box of its largest plant, inside the world', () => {
    for (const s of slots) {
      expect(s.x >= 0 && s.x <= WORLD_W && s.y <= WORLD_H, s.id).toBe(true);
      expect(box(s).y, s.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps slots out of the sky, off the promontory and the temple', () => {
    for (const s of slots) {
      expect(s.y, `${s.id} below the skyline`).toBeGreaterThan(skylineAt(s.x) + 5);
      expect(pointInPolygon({ x: s.x, y: s.y - 6 }, PROMONTORY), `${s.id} off the promontory`).toBe(false);
      expect(overlap(box(s), temple), `${s.id} hides the temple`).toBe(false);
    }
  });

  it('puts water slots in the sea clear of its edges, or in a rock pool; a large one for the seagrass', () => {
    for (const s of byHabitat('water')) {
      if (s.id.startsWith('pool-')) {
        expect(inPool(s), s.id).toBe(true);
      } else {
        expect(s.id.startsWith('shallows-'), s.id).toBe(true);
        expect(inSea(s), s.id).toBe(true);
        expect(edgeDistance(s, SEA_WATER), s.id).toBeGreaterThanOrEqual(30);
        expect(s.y, `${s.id} in the near shallows`).toBeGreaterThan(560);
      }
      for (const r of SPLASH_ROCKS) expect(Math.hypot(s.x - r.x, s.y - r.y), `${s.id} off the rock at ${r.x}`).toBeGreaterThan(r.w * 0.6);
    }
    expect(prefixed('shallows').length).toBeGreaterThanOrEqual(4);
    expect(prefixed('pool').length).toBeGreaterThanOrEqual(2);
    expect(byHabitat('water').filter((s) => s.maxSize === 'large').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps land slots on the land, the beach or the rocks, never in the sea', () => {
    for (const s of slots.filter((q) => q.habitat !== 'water')) {
      const onRock = s.id.startsWith('splash-');
      expect(onRock || !inSea(s), s.id).toBe(true);
      expect(inPool(s), s.id).toBe(false);
    }
    for (const s of byHabitat('shore')) {
      expect(pointInPolygon(s, BEACH), s.id).toBe(true);
      expect(edgeDistance(s, WATERLINE_EDGE, false), s.id).toBeLessThanOrEqual(100);
    }
    for (const s of slots.filter((q) => SLOT_TERRACE.has(q.id) || q.habitat === 'path')) expect(pointInPolygon(s, LAND), s.id).toBe(true);
  });

  it('puts rock slots on a wall’s coping or face with its terrace’s lift, on a splash rock, or on the bastion (ADR 0360)', () => {
    for (const s of byHabitat('rock')) {
      if (s.id.startsWith('splash-')) {
        expect(SPLASH_ROCKS.some((r) => Math.abs(s.x - r.x) <= r.w * 0.4 && s.y <= r.y && s.y >= r.y - r.w * 0.5), s.id).toBe(true);
        expect(s.scale, s.id).toBe(perspectiveScale(s.y));
        continue;
      }
      if (s.id.startsWith('shelf-')) {
        expect(edgeDistance(s, SHORE_EDGE, false), s.id).toBeLessThanOrEqual(40);
        continue;
      }
      const i = WALLS.findIndex((w) => {
        const y = copingAt(w, s.x);
        if (y === null) return false;
        return s.id.startsWith('wall-') ? Math.abs(s.y - y) <= 6 : s.y > y + 8 && s.y < y + w.h - 6;
      });
      expect(i, s.id).toBeGreaterThanOrEqual(0);
      expect(s.scale, s.id).toBe(perspectiveScale(s.y + LIFT[WALL_TERRACE[i]!]));
    }
  });

  it('gives raised ground its terrace’s scale and the ground the plain one, terraces between their walls', () => {
    for (const s of slots) {
      const t = SLOT_TERRACE.get(s.id);
      expect(s.scale, s.id).toBe(terraceScale(s.y, t));
      if (t) expect(s.scale, s.id).toBeGreaterThan(perspectiveScale(s.y));
      expect(s.scale, s.id).toBeGreaterThanOrEqual(FAR_SCALE);
      expect(s.scale, s.id).toBeLessThanOrEqual(NEAR_SCALE);
    }
    const [w1, w2, w3] = WALLS as [(typeof WALLS)[0], (typeof WALLS)[0], (typeof WALLS)[0]];
    const between = (s: Slot, back: (typeof WALLS)[0] | null, front: (typeof WALLS)[0]) => {
      const y = copingAt(front, s.x);
      const b = back ? copingAt(back, s.x) : null;
      return y !== null && s.y < y - 4 && (b === null || s.y > b! + back!.h + 4);
    };
    for (const s of slots.filter((q) => q.habitat !== 'rock')) {
      const t = SLOT_TERRACE.get(s.id);
      if (t === 'top' && s.habitat === 'meadow') expect(between(s, null, w1), s.id).toBe(true);
      if (t === 'middle') expect(between(s, w1, w2), s.id).toBe(true);
      if (t === 'lower') expect(between(s, w2, w3), s.id).toBe(true);
    }
    expect(LIFT.top).toBeGreaterThan(LIFT.middle);
    expect(LIFT.middle).toBeGreaterThan(LIFT.lower);
  });

  it('puts path slots beside the path, never on it, and keeps the rest off it', () => {
    for (const s of byHabitat('path')) {
      expect(pathDistance(s), s.id).toBeGreaterThanOrEqual(50);
      expect(pathDistance(s), s.id).toBeLessThanOrEqual(120);
    }
    for (const s of slots.filter((q) => q.habitat !== 'path')) expect(pathDistance(s), s.id).toBeGreaterThanOrEqual(40);
  });
});

describe('coast spacing at the garden scale (1.25×)', () => {
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

  it('never stands a plant over the base of one on a terrace or wall behind it', () => {
    const raised = slots.filter((s) => SLOT_TERRACE.has(s.id));
    for (const a of slots) for (const o of raised) if (o !== a) expect(covers(a, o), `${a.id} hides ${o.id}`).toBe(false);
  });

  it('spaces the trees so full-size crowns do not collide, and lets no tree hide a slot behind it', () => {
    const trees = slots.filter((s) => s.maxSize === 'tree');
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const a = trees[i]!;
        const b = trees[j]!;
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((PLANT_SIZES.tree.w * (plantScale(a) + plantScale(b))) / 2);
      }
      for (const s of slots) if (s !== trees[i]) expect(covers(trees[i]!, s), `${trees[i]!.id} hides ${s.id}`).toBe(false);
    }
  });

  it('stands the temple’s columns on its stylobate, on the promontory', () => {
    for (const c of COLUMNS) {
      expect(c.x).toBeGreaterThan(STYLOBATE.x0);
      expect(c.x).toBeLessThan(STYLOBATE.x1);
      expect(pointInPolygon({ x: c.x, y: STYLOBATE.y + 4 }, PROMONTORY), `${c.x}`).toBe(true);
    }
  });
});

describe('the coast sky (placeholder)', () => {
  const open = openSky();
  const inSky = (p: Pt, r = 0) => [p, { x: p.x, y: p.y + r }, { x: p.x - r, y: p.y }, { x: p.x + r, y: p.y }].every((q) => pointInPolygon(q, open));

  it('lights the scene from the left at both low suns: the sea and the open sky are there (ADR 0360)', () => {
    expect(sunSide(COAST_SKY_LAYOUT)).toEqual({ sunrise: -1, sunset: -1 });
  });

  it('raises and sets the sun over the sea’s horizon between the far hill and the temple', () => {
    for (const rising of [true, false]) {
      for (let alt = 8; alt <= 16; alt++) {
        const d = sunDisc(sky(alt, rising), COAST_SKY_LAYOUT);
        expect(inSky(d, d.r), `${rising ? 'rising' : 'setting'} at ${alt}°`).toBe(true);
        expect(d.x + d.r, 'left of the temple').toBeLessThan(temple.x);
      }
      const low = sunDisc(sky(-3, rising), COAST_SKY_LAYOUT);
      expect(pointInPolygon(low, open), 'hidden when it first shows').toBe(false);
    }
  });

  it('keeps the sun clear of the tree slots’ crowns and the painted pine’s', () => {
    const crowns = slots.filter((s) => s.maxSize === 'tree').map(box);
    for (const rising of [true, false]) {
      for (let alt = 0; alt <= 16; alt += 2) {
        const d = sunDisc(sky(alt, rising), COAST_SKY_LAYOUT);
        for (const c of crowns) expect(d.x + d.r < c.x || d.x - d.r > c.x + c.w, `sun at ${alt}°`).toBe(true);
        expect(d.x - d.r, 'right of the pine’s crown').toBeGreaterThan(420);
      }
    }
  });

  it('arcs the moon through open sky, under the corner controls on a 16:9 screen', () => {
    const top = Math.max(0, Math.min(100, COAST.view.focus.y - 450));
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const d = moonDisc(sky(-20, false, u), COAST_SKY_LAYOUT);
      expect(inSky(d, d.r), `moon at ${u.toFixed(2)}`).toBe(true);
      expect(d.y - d.r - top, `moon at ${u.toFixed(2)}`).toBeGreaterThanOrEqual(60);
      expect(d.x - d.r, 'right of the pine’s crown').toBeGreaterThan(420);
    }
  });

  it('scatters the stars in open sky only', () => {
    for (const seed of ['stars', 'a', 'b', 'c']) {
      for (const s of stars(40, seed, COAST_SKY_LAYOUT)) expect(inSky(s, 6), `${seed} ${s.x},${s.y}`).toBe(true);
    }
  });

  it('runs the open sky down to the painted silhouette everywhere, following the columns', () => {
    for (let x = 0; x <= WORLD_W; x += 0.5) expect(skylineAt(x), `${x}`).toBeGreaterThanOrEqual(silhouetteAt(x) - 0.01);
    const low = (x: number) => Math.max(...[-3, -1.5, 0, 1.5, 3].map((d) => silhouetteAt(x + d)));
    for (let x = temple.x - 20; x <= temple.x + temple.w + 20; x += 0.5) expect(skylineAt(x) - low(x), `${x}`).toBeLessThanOrEqual(5);
    // the sky runs down between the two tall columns under the architrave: no paper there
    expect(skylineAt((COLUMNS[0]!.x + COLUMNS[1]!.x) / 2)).toBeGreaterThanOrEqual(STYLOBATE.y);
  });

  it('keeps the sky plates’ band over the sky: the skyline (+40) is above its lower edge', () => {
    const r = COAST.sky.rect;
    for (const q of COAST.sky.shape(40)) expect(q.y, `${q.x}`).toBeLessThan(r.y + r.h);
    expect(coastScene.skyBand.bottom).toBeLessThan(coastScene.waterline);
  });
});

describe('the coast’s flora and wildlife (skeleton)', () => {
  it('lives on an Ionian clifftop terrace over the sea, cultivated (docs/research/coast-biome.md §5)', () => {
    expect(COAST.flora).toEqual({ realm: 'mediterranean', biomes: ['coast', 'scrub', 'garden', 'marine'], climate: 'mediterranean', cultivated: true });
  });

  it('offers by biology only what grows or is planted round the Mediterranean, and stays behind the flag', () => {
    const offered = floraOf(allSpecies(), COAST.flora);
    for (const sp of offered) expect([...sp.range.realms, ...(sp.range.cultivatedIn ?? [])], sp.id).toContain('mediterranean');
    const ids = offered.map((sp) => sp.id);
    expect(ids).toEqual(expect.arrayContaining(['caper', 'ice-plant']));
    const foreign = [...floraOf(allSpecies(), getScenery('japanese-garden').flora), ...floraOf(allSpecies(), getScenery('waterfall').flora)].map((sp) => sp.id);
    for (const id of foreign) expect(ids, id).not.toContain(id);
    expect(COAST.available(new URLSearchParams())).toBe(false);
  });

  it('shares the caper, oleander, pomegranate, grapevine and southern maidenhair with the oasis, and the ice plant with no other garden', () => {
    const SHARED = ['caper', 'grapevine', 'oleander', 'pomegranate', 'southern-maidenhair'];
    const offeredIn = (id: 'coast' | 'oasis' | 'japanese-garden' | 'waterfall') => floraOf(allSpecies(), getScenery(id).flora).map((sp) => sp.id);
    expect(offeredIn('coast')).toEqual(expect.arrayContaining(SHARED));
    expect(offeredIn('oasis')).toEqual(expect.arrayContaining(SHARED));
    for (const id of ['japanese-garden', 'waterfall'] as const) {
      for (const sp of [...SHARED, 'ice-plant']) expect(offeredIn(id), `${id} ${sp}`).not.toContain(sp);
    }
    expect(offeredIn('oasis')).not.toContain('ice-plant');
  });

  it('has an empty wildlife table, the sea as its still water', () => {
    expect(faunaTable('coast')).toBe(COAST.fauna.unlocks);
    expect(COAST.fauna.unlocks).toEqual([]);
    expect(COAST.fauna.water).toBeUndefined();
  });
});

describe('coast gardens in the saved state (schema v4)', () => {
  it('validates, exports and re-validates a garden whose plants grow on the coast', () => {
    const state = { ...createDefaultState(T0), scenery: 'coast' as const, plants: [makePlant({ sceneryId: 'coast', slotId: 'top-2' })] };
    const r = validateState(JSON.parse(JSON.stringify(state)), { now: T0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state.scenery).toBe('coast');
    expect(r.value.state.plants[0]!.sceneryId).toBe('coast');
    const again = importState(exportState(r.value.state, T0), { now: T0 });
    expect(again.ok && again.state.plants[0]!.sceneryId).toBe('coast');
  });
});
