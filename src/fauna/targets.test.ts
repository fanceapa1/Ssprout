import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import type { PlantInstance } from '../core/state';
import { gardenScene, type Slot } from '../scene/geometry';
import { pointInPolygon, polygonCentroid } from './math';
import {
  carried,
  choosePerch,
  inRegion,
  regionScale,
  flowerTargets,
  heronStands,
  lilyPads,
  perchesOf,
  perchY,
  perspectiveFit,
  plantBox,
  wallFootAt,
  wallTopAt,
  type Perch,
  type TargetSpecies,
} from './targets';

const species: Record<string, TargetSpecies> = {
  iris: { pollinators: true, habitats: ['shore'], size: { w: 80, h: 140 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: '#7b6ba8' },
  moss: { pollinators: false, habitats: ['rock'], size: { w: 40, h: 20 }, anchor: { x: 0.5, y: 0.9 }, bloomColor: '#a9b386' },
  lily: { pollinators: true, habitats: ['water'], size: { w: 90, h: 50 }, anchor: { x: 0.5, y: 0.7 }, bloomColor: '#faf6ee' },
};
const lookup = (id: string) => species[id];
const plant = (id: string, speciesId: string, slotId: string, seed = 7): PlantInstance => ({
  id,
  speciesId,
  sceneryId: 'japanese-garden',
  slotId,
  seed,
  plantedAt: 0,
  sessionMinutes: 25,
  taskName: 't',
  completedAt: 1,
});
const slots = gardenScene.slots;

describe('flowerTargets', () => {
  it('only pollinator plants, inside the top part of the sprite box', () => {
    const plants = [plant('a', 'iris', 'shore-1'), plant('b', 'moss', 'rock-1'), plant('c', 'unknown', 'shore-2')];
    const targets = flowerTargets(plants, slots, lookup);
    expect(targets.map((t) => t.plantId)).toEqual(['a']);
    const slot = slots.find((s) => s.id === 'shore-1')!;
    const box = plantBox(slot, species.iris!);
    const t = targets[0]!;
    expect(t.x).toBeGreaterThan(box.x);
    expect(t.x).toBeLessThan(box.x + box.w);
    expect(t.y).toBeGreaterThanOrEqual(box.y);
    expect(t.y).toBeLessThanOrEqual(box.y + box.h * 0.35);
    expect(t.baseY).toBe(slot.y);
  });

  it('is stable per plant seed', () => {
    const a = flowerTargets([plant('a', 'iris', 'shore-1', 5)], slots, lookup);
    const b = flowerTargets([plant('a', 'iris', 'shore-1', 5)], slots, lookup);
    expect(a).toEqual(b);
  });
});

describe('lilyPads', () => {
  it('needs a water species in a water slot', () => {
    const pads = lilyPads([plant('a', 'lily', 'water-1'), plant('b', 'iris', 'shore-1')], slots, lookup);
    expect(pads.map((p) => p.plantId)).toEqual(['a']);
    expect(pointInPolygon(pads[0]!, gardenScene.pond)).toBe(true);
    expect(lilyPads([plant('b', 'iris', 'shore-1')], slots, lookup)).toEqual([]);
  });
});

describe('perches', () => {
  const perches = perchesOf(gardenScene);

  it('uses perch-flagged rocks and the path stones', () => {
    const rockIds = perches.filter((p) => p.kind === 'rock').map((p) => p.id);
    expect(rockIds).toEqual(gardenScene.rocks.filter((r) => r.perch).map((r) => r.id));
    expect(perches.filter((p) => p.kind === 'stone')).toHaveLength(gardenScene.path.length);
    for (const p of perches.filter((q) => q.kind === 'rock')) {
      const rock = gardenScene.rocks.find((r) => r.id === p.id)!;
      expect(p.y).toBeLessThan(rock.y - rock.h * 0.8); // on top
      expect(p.depth).toBeGreaterThan(rock.y); // drawn in front of the rock
    }
  });

  it('perchY is highest in the middle', () => {
    const p = perches[0]!;
    expect(perchY(p, p.x)).toBe(p.y);
    expect(perchY(p, p.x + p.spread)).toBeGreaterThan(p.y);
    expect(perchY(p, p.x + p.spread * 5)).toBe(perchY(p, p.x + p.spread));
  });

  it('perchY follows a sloped perch (a frond, a receding coping) and clamps at the ends', () => {
    const p: Perch = { id: 'f', kind: 'frond', x: 100, y: 50, spread: 10, dome: 0, depth: 60, slope: 0.5 };
    expect(perchY(p, 100)).toBe(50);
    expect(perchY(p, 110)).toBeCloseTo(55);
    expect(perchY(p, 90)).toBeCloseTo(45);
    expect(perchY(p, 200)).toBeCloseTo(55);
  });

  it('a wall face gives its top and foot along x, clamped at its ends', () => {
    const face = { top: [{ x: 0, y: 100 }, { x: 100, y: 90 }], h: 30 };
    expect(wallTopAt(face, 50)).toBeCloseTo(95);
    expect(wallFootAt(face, 50)).toBeCloseTo(125);
    expect(wallTopAt(face, -20)).toBe(100);
    expect(wallTopAt(face, 300)).toBe(90);
  });

  it('a region is its outline minus its holes; a far stage has its own scale down its height (ADR 0373)', () => {
    const square = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
    const r = { outline: square(0, 100, 100), holes: [square(40, 140, 20)], scale: { top: 0.02, bottom: 0.06 } };
    expect(inRegion(r, { x: 10, y: 110 })).toBe(true);
    expect(inRegion(r, { x: 50, y: 150 })).toBe(false);
    expect(inRegion(r, { x: 150, y: 150 })).toBe(false);
    expect(regionScale(r, 100)).toBeCloseTo(0.02);
    expect(regionScale(r, 150)).toBeCloseTo(0.04);
    expect(regionScale(r, 400)).toBeCloseTo(0.06);
    expect(regionScale({ outline: r.outline }, 150)).toBeNull();
  });

  it('a point on a carrier follows its pose about the pivot; at rest or without one it stays', () => {
    const c = { pivot: { x: 100, y: 100 }, pose: { dx: 0, dy: 0, angle: 0 } };
    expect(carried({ x: 100, y: 60 }, c)).toEqual({ x: 100, y: 60 });
    expect(carried({ x: 100, y: 60 }, undefined)).toEqual({ x: 100, y: 60 });
    c.pose = { dx: 3, dy: -1, angle: Math.PI / 2 };
    const q = carried({ x: 100, y: 60 }, c);
    expect(q.x).toBeCloseTo(143);
    expect(q.y).toBeCloseTo(99);
  });

  it('choosePerch avoids occupied perches and prefers the kind asked for', () => {
    const rng = createRng(1);
    let rocks = 0;
    for (let i = 0; i < 200; i++) if (choosePerch(perches, [], rng, 'rock')!.kind === 'rock') rocks++;
    const share = perches.filter((p) => p.kind === 'rock').length / perches.length;
    expect(rocks / 200).toBeGreaterThan(share);
    const first = perches[0]!;
    for (let i = 0; i < 50; i++) expect(choosePerch(perches, [first], rng, 'rock')!.id).not.toBe(first.id);
    expect(choosePerch(perches, perches, rng, 'rock')).toBeNull();
  });
});

describe('heronStands', () => {
  it('are just inside the far half of the pond, away from things to avoid', () => {
    const pond = gardenScene.pond;
    const stands = heronStands(pond, []);
    expect(stands.length).toBeGreaterThan(3);
    for (const s of stands) {
      expect(pointInPolygon(s, pond)).toBe(true);
      expect(s.y).toBeLessThan(polygonCentroid(pond).y + 40);
    }
    const avoid = [{ x: stands[0]!.x, y: stands[0]!.y }];
    expect(heronStands(pond, avoid).every((s) => Math.hypot(s.x - avoid[0]!.x, s.y - avoid[0]!.y) >= 60)).toBe(true);
  });
});

describe('perspectiveFit', () => {
  it('grows toward the viewer and is clamped', () => {
    const f = perspectiveFit(slots);
    expect(f(420)).toBeLessThan(f(900));
    expect(f(-5000)).toBe(0.5);
    expect(f(5000)).toBe(1.2);
    expect(perspectiveFit([] as Slot[])(300)).toBe(1);
  });
});
