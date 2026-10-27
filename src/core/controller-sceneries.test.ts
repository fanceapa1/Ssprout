import { describe, expect, it } from 'vitest';
import type { Habitat, SizeClass, SpeciesDef, Tier } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { createManualClock } from './clock';
import { createSessionController, type StartOptions, type Ticker } from './controller';
import { createEventBus, type EventMap } from './events';
import { slotLookup, type SceneryId } from './sceneries';
import { createDefaultState, createReducer, createStore, type GardenState } from './state';
import { makePlant, MIN, T0 } from './testing';

/**
 * The controller with per-scenery gardens (ADR 0240): start in a garden, placement within a
 * garden, `showScenery`, sessions growing in a garden that is not on view, wildlife per garden.
 */

const def = (id: string, tier: Tier, habitats: Habitat[], sizeClass: SizeClass = 'small'): SpeciesDef => ({
  id,
  name: id,
  tier,
  habitats,
  sizeClass,
  size: { w: 10, h: 10 },
  anchor: { x: 0.5, y: 1 },
  description: '',
  bloomColor: '#fff',
  pollinators: true,
  draw: () => {},
});
const SPECIES = [def('violet', 1, ['meadow', 'rock']), def('lily', 1, ['water'], 'medium')];
const slot = (id: string, habitat: Habitat, maxSize: SizeClass): Slot => ({ id, x: 0, y: 0, habitat, maxSize, scale: 1 });
const SLOTS: Record<SceneryId, Slot[]> = {
  'japanese-garden': [slot('meadow-1', 'meadow', 'large'), slot('shared-1', 'meadow', 'large')],
  waterfall: [slot('pool-1', 'water', 'medium'), slot('shared-1', 'rock', 'small'), slot('ledge-1', 'rock', 'small')],
};

function setup(initial: GardenState = createDefaultState(T0)) {
  const clock = createManualClock(T0);
  const slots = slotLookup((id) => SLOTS[id]);
  const store = createStore(initial, createReducer({ getSpecies: (id) => SPECIES.find((s) => s.id === id), getSlot: slots.get }));
  const bus = createEventBus();
  const arrived: string[] = [];
  bus.on('fauna:arrived', (p: EventMap['fauna:arrived']) => arrived.push(p.id));
  let tick: (() => void) | null = null;
  const ticker: Ticker = { start: (fn) => ((tick = fn), () => (tick = null)) };
  const controller = createSessionController({ store, clock, bus, species: SPECIES, slots: slots.of, ticker, seed: 1 });
  const to = (min: number) => {
    clock.set(T0 + min * MIN);
    tick?.();
  };
  return { store, controller, arrived, to };
}

const opts = (over: Partial<StartOptions> = {}): StartOptions => ({ taskName: 'Task', goalMinutes: 25, speciesId: 'violet', slotId: 'shared-1', ...over });

describe('controller with per-scenery gardens', () => {
  it('starts in the garden on view by default, or in the one asked for; status says where each grows', () => {
    const { controller, store } = setup();
    expect(controller.start(opts())).toBe(true);
    expect(controller.start(opts({ taskName: 'Falls', sceneryId: 'waterfall' }))).toBe(true);
    expect(store.get().session!.sceneryId).toBe('waterfall');
    expect(controller.status().sessions.map((s) => [s.session.taskName, s.sceneryId])).toEqual([
      ['Task', 'japanese-garden'],
      ['Falls', 'waterfall'],
    ]);
    controller.showScenery('waterfall');
    expect(controller.start(opts({ taskName: 'Ledge', slotId: 'ledge-1' }))).toBe(true);
    expect(store.get().session).toMatchObject({ taskName: 'Ledge', sceneryId: 'waterfall' });
  });

  it('placementOptions lists one garden’s slots, its occupants and its held spots', () => {
    const plants = [makePlant({ id: 'wf', sceneryId: 'waterfall', slotId: 'ledge-1' }), makePlant({ id: 'jp', slotId: 'meadow-1' })];
    const { controller } = setup({ ...createDefaultState(T0), plants });
    const options = (sc?: SceneryId) => controller.placementOptions('violet', sc).map((o) => [o.slot.id, o.occupiedBy?.id ?? null]);
    expect(options()).toEqual([['meadow-1', 'jp'], ['shared-1', null]]);
    expect(options('waterfall')).toEqual([['shared-1', null], ['ledge-1', 'wf']]);
    controller.start(opts({ sceneryId: 'waterfall' }));
    expect(options('waterfall')).toEqual([['ledge-1', 'wf']]);
    expect(options('japanese-garden')).toEqual([['meadow-1', 'jp'], ['shared-1', null]]); // not held here
    expect(controller.placementOptions('lily', 'waterfall').map((o) => o.slot.id)).toEqual(['pool-1']);
    expect(controller.placementOptions('violet', 'coast' as SceneryId)).toEqual([]);
  });

  it('showScenery changes the garden on view only', () => {
    const { controller, store } = setup();
    controller.start(opts());
    const session = store.get().session;
    expect(controller.showScenery('waterfall')).toBe(true);
    expect(store.get().scenery).toBe('waterfall');
    expect(store.get().session).toBe(session);
    expect(controller.showScenery('waterfall')).toBe(false);
    expect(controller.showScenery('coast' as SceneryId)).toBe(false);
  });

  it('a session keeps growing in its garden while another is on view, and blooms there', () => {
    const { controller, store, to } = setup();
    controller.start(opts());
    controller.showScenery('waterfall');
    to(10);
    expect(controller.status().phase).toBe('focus');
    to(25);
    expect(store.get().plants).toEqual([expect.objectContaining({ sceneryId: 'japanese-garden', slotId: 'shared-1' })]);
    expect(store.get().scenery).toBe('waterfall');
  });

  it('announceFauna records a creature in a garden (default: the one on view) and announces the bare id', () => {
    const { controller, store, arrived } = setup();
    expect(controller.announceFauna('dragonfly')).toBe(true);
    expect(controller.announceFauna('dragonfly', 'waterfall')).toBe(true);
    controller.showScenery('waterfall');
    expect(controller.announceFauna('dragonfly')).toBe(false);
    expect(controller.announceFauna('')).toBe(false);
    expect(store.get().faunaSeen).toEqual(['dragonfly', 'waterfall:dragonfly']);
    expect(arrived).toEqual(['dragonfly', 'dragonfly']);
  });
});
