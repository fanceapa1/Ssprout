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
import { OASIS, OASIS_DRAFT_STEPS, OASIS_ELEMENTS, oasisAvailable } from '.';
import { STEPS as DRAFT_STEPS } from './drafts/a/paint';
import { BAR, BASIN_STONE, BASIN_WATER, OUED_WATER, oasisScene, SEGUIA, SLUICE_WATER } from './geometry';
import { BLUFF, copingAt, FOOTPATH, LIFT, OASIS_HABITAT_WORDS, OASIS_SKY_LAYOUT, openSky, silhouetteAt, skylineAt, terraceScale, WALLS } from './layout';
import { KSAR_SHAPES } from './ksar';
import { SLOT_TERRACE } from './slots';

const { slots } = oasisScene;
const byHabitat = (h: string) => slots.filter((s) => s.habitat === h);

function edgeDistance(p: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

const onBar = (p: Pt) => ((p.x - BAR.cx) / BAR.rx) ** 2 + ((p.y - BAR.cy) / BAR.ry) ** 2 < 1;
const channels = [...SEGUIA, SLUICE_WATER];
const inWater = (p: Pt) => pointInPolygon(p, BASIN_WATER) || channels.some((c) => pointInPolygon(p, c)) || (pointInPolygon(p, OUED_WATER) && !onBar(p));
/** How far a land slot is from the water's edge: the basin counts with its stone rim, the bar's edge is the oued's. */
const waterEdge = (p: Pt) => Math.min(edgeDistance(p, BASIN_STONE), ...channels.map((c) => edgeDistance(p, c)), edgeDistance(p, OUED_WATER), onBar(p) ? 0 : Infinity);

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

/** A daylight state carrying only what the sky layout reads. */
const sky = (alt: number, rising: boolean, moon = 0) =>
  ({ sunAltitude: alt, sunRising: rising, moonProgress: moon, weights: { sunrise: 1, sunset: 1, midday: 0, night: 1 } }) as unknown as DaylightState;

describe('the oasis scenery', () => {
  it('is hidden unless asked for with ?dev&scenery=oasis', () => {
    expect(oasisAvailable(new URLSearchParams())).toBe(false);
    expect(oasisAvailable(new URLSearchParams('scenery=oasis'))).toBe(false);
    expect(oasisAvailable(new URLSearchParams('dev&scenery=waterfall'))).toBe(false);
    expect(oasisAvailable(new URLSearchParams('dev&scenery=oasis'))).toBe(true);
    expect(OASIS.available).toBe(oasisAvailable);
  });

  it('is consistent with itself and has no building, lantern, eave, falls or motion yet', () => {
    expect(OASIS.id).toBe('oasis');
    expect(OASIS.art.scenery).toBe('oasis');
    expect(OASIS.art.scene).toBe(OASIS.geometry);
    expect(OASIS.light.sky).toBe(OASIS.sky.layout);
    expect(oasisScene.structure).toBeNull();
    expect(oasisScene.lights).toEqual([]);
    expect(oasisScene.eave).toBeNull();
    expect(oasisScene.falls).toBeNull();
    expect(oasisScene.pond).toBe(BASIN_WATER);
    expect(OASIS.motion).toBeUndefined();
    expect(OASIS.blurb.length).toBeLessThanOrEqual(110);
  });

  it("paints every draft step but the draft's own sky, in the draft's order, and only the asked-for elements", () => {
    const names = OASIS.art.steps(OASIS.art).map((s) => s.name);
    expect(names).toEqual(DRAFT_STEPS.map((s) => s.name).filter((n) => n !== 'sky'));
    expect(names).toEqual(OASIS_DRAFT_STEPS);
    expect(OASIS.art.steps(OASIS.art, ['water']).map((s) => s.name)).toEqual([...OASIS_ELEMENTS.water]);
    expect(OASIS.art.steps(OASIS.art, ['rock', 'palms']).map((s) => s.name)).toEqual(['bluff', 'ksar', 'big-palms']);
  });

  it('records a habitat word for every habitat', () => {
    for (const h of HABITATS) expect(OASIS_HABITAT_WORDS[h], h).toMatch(/\w/);
    expect(OASIS.habitatWords).toBe(OASIS_HABITAT_WORDS);
  });

  it('keeps the whole ksar, most of the basin and both low suns in the portrait crop', () => {
    const { focus } = OASIS.view;
    const crop = { x0: focus.x - MIN_VISIBLE_W / 2, x1: focus.x + MIN_VISIBLE_W / 2 };
    for (const s of KSAR_SHAPES.filter((q) => q.block.kind !== 'curtain')) {
      const b = bounds([...s.front, ...s.flank]);
      expect(b.x >= crop.x0 && b.x + b.w <= crop.x1, s.block.id).toBe(true);
    }
    const b = bounds(BASIN_WATER);
    expect(Math.min(b.x + b.w, crop.x1) - Math.max(b.x, crop.x0)).toBeGreaterThanOrEqual(b.w * 0.85);
    for (const x of [OASIS_SKY_LAYOUT.sunsetX, OASIS_SKY_LAYOUT.sunriseX]) expect(x > crop.x0 + 30 && x < crop.x1 - 30, `${x}`).toBe(true);
  });

  it('keeps the ksar clear of the top edge and the corner controls, with sky above it (1440 and 1920 wide)', () => {
    for (const s of KSAR_SHAPES) {
      const b = bounds([...s.front, ...s.flank]);
      expect(b.y, s.block.id).toBeGreaterThanOrEqual(150);
      expect(b.x, s.block.id).toBeGreaterThan(290);
      expect(b.x + b.w, s.block.id).toBeLessThan(1220);
    }
    // a 16:9 screen shows 900 of the 1000 units, placed round the focus
    const top = Math.max(0, Math.min(100, OASIS.view.focus.y - 450));
    expect(Math.min(...KSAR_SHAPES.map((s) => bounds(s.front).y)) - top).toBeGreaterThanOrEqual(75);
  });

  it('leaves the garden by the footpath, nearest first, from the bottom edge', () => {
    expect(OASIS.view.pathOut).toBe(FOOTPATH);
    expect(FOOTPATH[0]!.y).toBe(WORLD_H);
    for (let i = 1; i < FOOTPATH.length; i++) expect(FOOTPATH[i]!.y).toBeLessThan(FOOTPATH[i - 1]!.y);
    expect(edgeDistance(FOOTPATH[FOOTPATH.length - 1]!, BASIN_STONE)).toBeLessThan(40);
  });
});

describe('oasis water', () => {
  it('opens the basin inside its stone rim, its waterline at the far edge', () => {
    for (const q of BASIN_WATER) expect(pointInPolygon(q, BASIN_STONE) || edgeDistance(q, BASIN_STONE) < 1).toBe(true);
    expect(oasisScene.waterline).toBe(bounds(BASIN_WATER).y);
  });

  it('runs the seguia, the sluice and the oued as moving water, the oued out past the bottom edge', () => {
    expect(oasisScene.streams).toEqual([...SEGUIA, SLUICE_WATER, OUED_WATER]);
    expect(bounds(OUED_WATER).y + bounds(OUED_WATER).h).toBeGreaterThanOrEqual(WORLD_H);
    const last = SEGUIA[SEGUIA.length - 1]!;
    expect(bounds(last).y + bounds(last).h).toBeGreaterThanOrEqual(WORLD_H);
    expect(pointInPolygon({ x: BAR.cx, y: BAR.cy }, OUED_WATER)).toBe(true);
  });
});

describe('oasis slots', () => {
  it('has 40–49 slots with unique, place-prefixed ids', () => {
    expect(slots.length).toBeGreaterThanOrEqual(40);
    expect(slots.length).toBeLessThanOrEqual(49);
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
    for (const s of slots) expect(s.id).toMatch(/^(basin|shallows|rim|seguia|oued|bar|plot|walk|high|grove|palm|wall|talus)-\d+$/);
  });

  it('uses known habitats and sizes and offers every habitat (at least four slots each) and every size', () => {
    for (const s of slots) {
      expect(HABITATS).toContain(s.habitat);
      expect(SIZE_CLASSES).toContain(s.maxSize);
    }
    for (const h of HABITATS) expect(byHabitat(h).length, h).toBeGreaterThanOrEqual(4);
    for (const z of SIZE_CLASSES) expect(slots.filter((s) => s.maxSize === z).length, z).toBeGreaterThanOrEqual(2);
  });

  it('keeps every slot, and the 1.25× box of its largest plant, inside the world', () => {
    for (const s of slots) {
      expect(s.x >= 0 && s.x <= WORLD_W && s.y <= WORLD_H, s.id).toBe(true);
      expect(box(s).y, s.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps slots out of the sky and off the bluff', () => {
    for (const s of slots) {
      expect(s.y, `${s.id} below the skyline`).toBeGreaterThan(skylineAt(s.x) + 5);
      expect(pointInPolygon(s, openSky()), s.id).toBe(false);
      expect(pointInPolygon({ x: s.x, y: s.y - 6 }, BLUFF), `${s.id} off the bluff`).toBe(false);
    }
  });

  it('puts water slots on the water, clear of its edge; two large ones in the basin, one in the overflow corner by the sluice', () => {
    for (const s of byHabitat('water')) {
      expect(inWater(s), s.id).toBe(true);
      const basin = s.id.startsWith('basin-');
      expect(basin || s.id.startsWith('shallows-'), s.id).toBe(true);
      expect(edgeDistance(s, basin ? BASIN_WATER : OUED_WATER), s.id).toBeGreaterThanOrEqual(basin ? 30 : 24);
      if (s.id.startsWith('shallows-')) expect(onBar(s), s.id).toBe(false);
    }
    expect(byHabitat('water').filter((s) => s.id.startsWith('basin-') && s.maxSize === 'large').length).toBeGreaterThanOrEqual(2);
    const corner = BASIN_WATER[2]!;
    expect(byHabitat('water').some((s) => s.maxSize === 'large' && Math.hypot(s.x - corner.x, s.y - corner.y) < 80)).toBe(true);
  });

  it('keeps land slots off the water and the basin stone, and shore slots within reach of the water', () => {
    for (const s of slots.filter((q) => q.habitat !== 'water')) {
      expect(inWater(s), s.id).toBe(false);
      expect(pointInPolygon(s, BASIN_STONE), s.id).toBe(false);
    }
    for (const s of byHabitat('shore')) expect(waterEdge(s), s.id).toBeLessThanOrEqual(45);
  });

  it('puts rock slots on the talus under the bluff, or on a wall’s coping with the lift of the terrace it holds (ADR 0300)', () => {
    const lift = [LIFT.grove, LIFT.high, LIFT.middle];
    const talus = byHabitat('rock').filter((s) => s.id.startsWith('talus-'));
    expect(talus.length).toBeGreaterThanOrEqual(2);
    for (const s of talus) expect(edgeDistance(s, BLUFF), s.id).toBeLessThanOrEqual(20);
    for (const s of byHabitat('rock').filter((q) => !talus.includes(q))) {
      const i = WALLS.findIndex((w) => {
        const y = copingAt(w, s.x);
        return y !== null && Math.abs(s.y - y) <= 6;
      });
      expect(i, s.id).toBeGreaterThanOrEqual(0);
      expect(s.scale, s.id).toBe(perspectiveScale(s.y + lift[i]!));
    }
  });

  it('gives raised ground its terrace’s scale and the basin terrace the ground’s', () => {
    for (const s of slots) {
      const t = SLOT_TERRACE.get(s.id);
      expect(s.scale, s.id).toBe(terraceScale(s.y, t));
      if (t) expect(s.scale, s.id).toBeGreaterThan(perspectiveScale(s.y));
      expect(s.scale, s.id).toBeGreaterThanOrEqual(FAR_SCALE);
      expect(s.scale, s.id).toBeLessThanOrEqual(NEAR_SCALE);
    }
    // the high terrace sits between the bluff's foot and the high wall's coping
    for (const s of slots.filter((q) => SLOT_TERRACE.get(q.id) === 'high' && q.habitat !== 'rock')) {
      expect(s.y, s.id).toBeLessThanOrEqual(copingAt(WALLS[1]!, s.x)!);
    }
    expect(LIFT.high).toBeGreaterThan(LIFT.middle);
  });

  it('puts footpath slots beside the footpath, never on it', () => {
    for (const s of byHabitat('path')) {
      const d = edgeDistance(s, [...FOOTPATH, ...FOOTPATH.slice().reverse()]);
      expect(d, s.id).toBeGreaterThanOrEqual(50);
      expect(d, s.id).toBeLessThanOrEqual(120);
    }
    for (const s of slots.filter((q) => q.habitat !== 'path')) expect(edgeDistance(s, [...FOOTPATH, ...FOOTPATH.slice().reverse()]), s.id).toBeGreaterThanOrEqual(40);
  });
});

describe('oasis spacing at the garden scale (1.25×)', () => {
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
    expect(trees.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const a = trees[i]!;
        const b = trees[j]!;
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((PLANT_SIZES.tree.w * (plantScale(a) + plantScale(b))) / 2);
      }
      for (const s of slots) if (s !== trees[i]) expect(covers(trees[i]!, s), `${trees[i]!.id} hides ${s.id}`).toBe(false);
    }
  });
});

describe('the oasis sky (placeholder until O5)', () => {
  const open = openSky();
  const inSky = (p: Pt, r = 0) => [p, { x: p.x, y: p.y + r }, { x: p.x - r, y: p.y }, { x: p.x + r, y: p.y }].every((q) => pointInPolygon(q, open));

  it('lights the scene from the right at both low suns, as the painting is (ADR 0300)', () => {
    expect(sunSide(OASIS_SKY_LAYOUT)).toEqual({ sunrise: 1, sunset: 1 });
    expect(OASIS_SKY_LAYOUT.sunriseX).toBeGreaterThan(OASIS_SKY_LAYOUT.sunsetX);
  });

  it('raises and sets the sun in the open notch right of the ksar, from behind the far range', () => {
    for (const rising of [true, false]) {
      for (let alt = 8; alt <= 16; alt++) {
        const d = sunDisc(sky(alt, rising), OASIS_SKY_LAYOUT);
        expect(inSky(d, d.r), `${rising ? 'rising' : 'setting'} at ${alt}°`).toBe(true);
      }
      const low = sunDisc(sky(-3, rising), OASIS_SKY_LAYOUT);
      expect(pointInPolygon(low, open), 'hidden when it first shows').toBe(false);
    }
  });

  it('keeps the sun clear of the tree slots’ crowns', () => {
    const crowns = slots.filter((s) => s.maxSize === 'tree').map(box);
    for (const rising of [true, false]) {
      for (let alt = 0; alt <= 16; alt += 2) {
        const d = sunDisc(sky(alt, rising), OASIS_SKY_LAYOUT);
        for (const c of crowns) expect(d.x + d.r < c.x || d.x - d.r > c.x + c.w, `sun at ${alt}°`).toBe(true);
      }
    }
  });

  it('arcs the moon through open sky', () => {
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const d = moonDisc(sky(-20, false, u), OASIS_SKY_LAYOUT);
      expect(inSky(d, d.r), `moon at ${u.toFixed(2)}`).toBe(true);
    }
  });

  it('scatters the stars in open sky only, off the ksar', () => {
    for (const seed of ['stars', 'a', 'b', 'c']) {
      for (const s of stars(40, seed, OASIS_SKY_LAYOUT)) expect(inSky(s, 6), `${seed} ${s.x},${s.y}`).toBe(true);
    }
  });

  it('runs the open sky down to the painted silhouette everywhere, so no paper shows between the towers', () => {
    for (let x = 0; x <= WORLD_W; x += 0.5) expect(skylineAt(x), `${x}`).toBeGreaterThanOrEqual(silhouetteAt(x) - 0.01);
    // and it follows the towers' horns and crenels, not a box over them: never more than 5 under them (at most 3 off an upright edge)
    const low = (x: number) => Math.max(...[-3, -1.5, 0, 1.5, 3].map((d) => silhouetteAt(x + d)));
    for (let x = 300; x <= 1000; x += 0.5) expect(skylineAt(x) - low(x), `${x}`).toBeLessThanOrEqual(5);
  });

  it('keeps the sky plates’ band over the sky: the skyline (+40) is above its lower edge', () => {
    const r = OASIS.sky.rect;
    for (const q of OASIS.sky.shape(40)) expect(q.y, `${q.x}`).toBeLessThan(r.y + r.h);
    expect(oasisScene.skyBand.bottom).toBeLessThan(oasisScene.waterline);
  });
});

describe('the oasis’s flora and wildlife (skeleton)', () => {
  it('lives in the Saharan oases, cultivated', () => {
    expect(OASIS.flora).toMatchObject({ realm: 'n-africa-arabia', climate: 'arid', cultivated: true });
    expect([...OASIS.flora.biomes].sort()).toEqual(['desert', 'wetland']);
  });

  // why it stays behind the dev flag: the flora invariants (src/scenery/flora.test.ts) hold for released sceneries only
  it('offers only its own species so far (none is shared by biology), so it stays behind the dev flag', () => {
    expect(floraOf(allSpecies(), OASIS.flora).every((sp) => [...sp.range.realms, ...(sp.range.cultivatedIn ?? [])].includes('n-africa-arabia'))).toBe(true);
    expect(OASIS.available(new URLSearchParams())).toBe(false);
  });

  it('shares only the creatures biology allows (O0), the basin as still water', () => {
    expect(faunaTable('oasis')).toBe(OASIS.fauna.unlocks);
    expect(OASIS.fauna.unlocks.map((r) => (r.variant ? r.kind + '/' + r.variant : r.kind))).toEqual([
      'strider/margin', 'leaf/katsura', 'butterfly/white', 'bee', 'butterfly/swallowtail', 'swallow', 'heron',
    ]);
    expect(new Set(OASIS.fauna.unlocks.map((r) => r.id)).size).toBe(OASIS.fauna.unlocks.length);
    expect(OASIS.fauna.water!.still).toBe(BASIN_WATER);
    expect(OASIS.fauna.water!.moving).toContain(OUED_WATER);
  });
});

describe('oasis gardens in the saved state (schema v4)', () => {
  it('validates, exports and re-validates a garden whose plants grow in the oasis', () => {
    const state = { ...createDefaultState(T0), scenery: 'oasis' as const, plants: [makePlant({ sceneryId: 'oasis', slotId: 'plot-1' })] };
    const r = validateState(JSON.parse(JSON.stringify(state)), { now: T0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state.scenery).toBe('oasis');
    expect(r.value.state.plants[0]!.sceneryId).toBe('oasis');
    const again = importState(exportState(r.value.state, T0), { now: T0 });
    expect(again.ok && again.state.plants[0]!.sceneryId).toBe('oasis');
  });
});
