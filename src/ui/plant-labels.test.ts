import { describe, expect, it } from 'vitest';
import type { PlantInstance } from '../core/state';
import type { SpeciesDef } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { hitPlant, plantBox, plantLabelText } from './plant-labels';

const def = (id: string, w: number, h: number) => ({ id, name: id, size: { w, h }, anchor: { x: 0.5, y: 0.95 } }) as unknown as SpeciesDef;
const slot = (id: string, x: number, y: number, scale = 1): Slot => ({ id, x, y, scale, habitat: 'meadow', maxSize: 'tree' });
const plant = (id: string, speciesId: string, slotId: string): PlantInstance =>
  ({ id, speciesId, slotId, seed: 1, plantedAt: Date.UTC(2026, 9, 21, 12), sessionMinutes: 50 }) as PlantInstance;

describe('plant hit-testing', () => {
  const species = new Map([
    ['small', def('small', 40, 40)],
    ['tree', def('tree', 200, 260)],
  ]);
  const slots = new Map([
    ['a', slot('a', 500, 600)],
    ['b', slot('b', 500, 640)],
    ['back', slot('back', 400, 420, 0.6)],
  ]);
  const plants = [plant('p1', 'tree', 'back'), plant('p2', 'small', 'a'), plant('p3', 'small', 'b')];
  const get = (id: string) => species.get(id);

  it('computes sprite boxes from slot scale and anchor', () => {
    // the garden draws plants GARDEN_PLANT_SCALE (1.25×) larger than size × slot scale (ADR 0148)
    expect(plantBox(def('x', 100, 200), slot('s', 300, 500, 0.5))).toEqual({ left: 268.75, top: 381.25, right: 331.25, bottom: 506.25 });
  });

  it('finds the plant under a point, preferring the frontmost', () => {
    expect(hitPlant({ x: 500, y: 590 }, plants, slots, get)?.id).toBe('p2');
    expect(hitPlant({ x: 500, y: 620 }, plants, slots, get)?.id).toBe('p3'); // overlap: b is in front
    expect(hitPlant({ x: 400, y: 330 }, plants, slots, get)?.id).toBe('p1');
    expect(hitPlant({ x: 50, y: 50 }, plants, slots, get)).toBeNull();
  });

  it('skips unknown species and slots', () => {
    expect(hitPlant({ x: 500, y: 590 }, [plant('x', 'nope', 'a'), plant('y', 'small', 'gone')], slots, get)).toBeNull();
  });

  it('labels with task · minutes · date', () => {
    expect(plantLabelText({ ...plant('p', 'small', 'a'), taskName: 'Biology ch. 4' })).toBe('Biology ch. 4 · 50 min · 21 October 2026');
    expect(plantLabelText(plant('p', 'small', 'a'), { name: 'Violet' })).toBe('Violet · 50 min · 21 October 2026');
  });
});
