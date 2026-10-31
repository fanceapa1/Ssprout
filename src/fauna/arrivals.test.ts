import { describe, expect, it } from 'vitest';
import { createEventBus } from '../core/events';
import { createDefaultState, createStore, reducer, type PlantInstance } from '../core/state';
import { gardenScene } from '../scene/geometry';
import { JAPANESE_FAUNA } from '../scenery/japanese-garden/fauna';
import type { Scenery } from '../scenery/types';
import { WATERFALL_WILDLIFE } from '../scenery/waterfall/fauna';
import { waterfallScene } from '../scenery/waterfall/geometry';
import { createViewport } from '../render/viewport';
import type { SystemContext } from '../render/types';
import { createFaunaSystem, sightedFauna } from './system';
import type { TargetSpecies } from './targets';
import type { Creature } from './types';

const at = (kind: Creature['kind'], x: number, y: number, extra: Partial<Creature> = {}) => ({ kind, x, y, forced: false, done: false, ...extra }) as Creature;
const view = { x: 0, y: 0, w: 1600, h: 1000 };

describe('sightedFauna', () => {
  it('maps creatures in view to their unlock ids, counting koi', () => {
    const ids = sightedFauna([at('koi', 800, 560), at('koi', 900, 600), at('dragonfly', 700, 500), at('bird', 600, 450)], view, JAPANESE_FAUNA);
    expect([...ids].sort()).toEqual(['dragonfly', 'koi-1', 'koi-2', 'small-birds']);
  });

  it('ignores creatures out of view, leaving, or spawned by hand', () => {
    const ids = sightedFauna([at('heron', -200, 600), at('swallow', 800, 100, { done: true }), at('bee', 800, 600, { forced: true })], view, JAPANESE_FAUNA);
    expect(ids.size).toBe(0);
  });

  it('a row naming a variant is only sighted by a creature of that variant', () => {
    const rows = [
      { id: 'iwana-1', kind: 'iwana', variant: 'iwana' },
      { id: 'iwana-2', kind: 'iwana', variant: 'yamame' },
      { id: 'dragonfly', kind: 'dragonfly', variant: 'aka' },
    ];
    expect([...sightedFauna([at('iwana', 800, 600, { variant: 'yamame' }), at('dragonfly', 700, 500, { variant: 'shiokara' })], view, rows)]).toEqual(['iwana-2']);
  });
});

describe('fauna arrivals', () => {
  const flower: TargetSpecies = { pollinators: true, habitats: ['meadow'], size: { w: 60, h: 90 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: '#e8a7a9' };
  const plants = (n: number): PlantInstance[] =>
    gardenScene.slots.slice(0, n).map((s, i) => ({ id: `p${i}`, speciesId: 'flower', sceneryId: 'japanese-garden', slotId: s.id, seed: i + 1, plantedAt: 0, sessionMinutes: 25, taskName: 't', completedAt: 1 }));

  it('emits fauna:arrived once, when a newly unlocked koi is first in view — not on unlock', () => {
    const store = createStore(createDefaultState(0), reducer);
    const bus = createEventBus();
    const arrived: string[] = [];
    bus.on('fauna:arrived', ({ id, sceneryId }) => arrived.push(`${sceneryId}/${id}`));
    const system = createFaunaSystem({ species: () => flower, seed: 3 });
    const ctx = { viewport: createViewport(1600, 1000), store, bus, clock: { now: () => 12 * 3600_000 }, scene: gardenScene, reducedMotion: false } as unknown as SystemContext;
    system.init!(ctx);
    store.dispatch({ type: 'state/replace', state: { ...store.get(), plants: plants(3) } });
    // unlocking alone says nothing
    expect(arrived).toEqual([]);
    for (let i = 0; i < 40; i++) system.update!({ t: i * 0.1, dt: 0.1, now: 12 * 3600_000 });
    expect(arrived.filter((id) => id.endsWith('/koi-1'))).toEqual(['japanese-garden/koi-1']);
    system.dispose!();
  });

  it('announces a creature per garden: a dragonfly seen in the garden is still new at the waterfall, once', () => {
    const noon = 12 * 3600_000;
    const waterfallPlants = waterfallScene.slots
      .slice(0, 6)
      .map((s, i) => ({ id: `w${i}`, speciesId: 'flower', sceneryId: 'waterfall' as const, slotId: s.id, seed: i + 1, plantedAt: 0, sessionMinutes: 25, taskName: 't', completedAt: 1 }));
    const run = (faunaSeen: string[]) => {
      const store = createStore({ ...createDefaultState(0), scenery: 'waterfall', plants: waterfallPlants, faunaSeen }, reducer);
      const bus = createEventBus();
      const arrived: string[] = [];
      bus.on('fauna:arrived', ({ id, sceneryId }) => arrived.push(`${sceneryId}/${id}`));
      const system = createFaunaSystem({ species: () => flower, seed: 5 });
      const scenery = { id: 'waterfall', fauna: WATERFALL_WILDLIFE } as unknown as Scenery;
      const ctx = { viewport: createViewport(1600, 1000), store, bus, clock: { now: () => noon }, scene: waterfallScene, scenery, reducedMotion: false } as unknown as SystemContext;
      system.init!(ctx);
      const [dragonfly] = system.sim!.spawn('dragonfly', { forced: false });
      for (let i = 0; i < 80; i++) system.update!({ t: i * 0.1, dt: 0.1, now: noon });
      system.dispose!();
      return { arrived, ids: system.unlocked().map((r) => r.id), variant: dragonfly?.variant };
    };
    const first = run(['dragonfly']);
    expect(first.ids).toContain('dragonfly');
    // the waterfall's dragonflies are aka-tombo
    expect(first.variant).toBe('aka');
    expect(first.arrived).toContain('waterfall/dragonfly');
    // after the quiet line has recorded it there (a reload): not again
    expect(run(['dragonfly', 'waterfall:dragonfly']).arrived).not.toContain('waterfall/dragonfly');
  });
});
