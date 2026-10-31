import { describe, expect, it } from 'vitest';
import { EVERYWHERE } from '../plants/biomes';
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
  range: EVERYWHERE,
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

/** each garden's flora (ADR 0250): the lily grows only in the Japanese garden */
const FLORA: Record<SceneryId, string[]> = { 'japanese-garden': ['violet', 'lily'], waterfall: ['violet'] };
const speciesIn = (id: SceneryId) => SPECIES.filter((s) => FLORA[id].includes(s.id));

function setup(initial: GardenState = createDefaultState(T0), flora = false) {
  const clock = createManualClock(T0);
  const slots = slotLookup((id) => SLOTS[id]);
  const grows = flora ? (speciesId: string, id: SceneryId) => FLORA[id].includes(speciesId) : undefined;
  const store = createStore(initial, createReducer({ getSpecies: (id) => SPECIES.find((s) => s.id === id), getSlot: slots.get, grows }));
  const bus = createEventBus();
  const arrived: string[] = [];
  bus.on('fauna:arrived', (p: EventMap['fauna:arrived']) => arrived.push(`${p.sceneryId}:${p.id}`));
  let tick: (() => void) | null = null;
  const ticker: Ticker = { start: (fn) => ((tick = fn), () => (tick = null)) };
  const controller = createSessionController({ store, clock, bus, species: SPECIES, speciesIn: flora ? speciesIn : undefined, slots: slots.of, ticker, seed: 1 });
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

  it('announceFauna records a creature in a garden (default: the one on view) and announces it with that garden', () => {
    const { controller, store, arrived } = setup();
    expect(controller.announceFauna('dragonfly')).toBe(true);
    expect(controller.announceFauna('dragonfly', 'waterfall')).toBe(true);
    controller.showScenery('waterfall');
    expect(controller.announceFauna('dragonfly')).toBe(false);
    expect(controller.announceFauna('')).toBe(false);
    expect(store.get().faunaSeen).toEqual(['dragonfly', 'waterfall:dragonfly']);
    expect(arrived).toEqual(['japanese-garden:dragonfly', 'waterfall:dragonfly']);
  });
});

describe('each garden offers its own flora (ADR 0250)', () => {
  it('selectableSpecies lists the garden on view, or the one asked for', () => {
    const { controller } = setup(createDefaultState(T0), true);
    const listed = (sc?: SceneryId) => controller.selectableSpecies(25, sc).map((s) => s.species.id);
    expect(listed()).toEqual(['lily', 'violet']);
    expect(listed('waterfall')).toEqual(['violet']);
    controller.showScenery('waterfall');
    expect(listed()).toEqual(['violet']);
    expect(listed('japanese-garden')).toEqual(['lily', 'violet']);
  });

  it('a species that does not grow in a garden has no spot there, and starting it there is a no-op', () => {
    const { controller, store } = setup(createDefaultState(T0), true);
    expect(controller.placementOptions('lily', 'waterfall')).toEqual([]);
    const before = store.get();
    expect(controller.start(opts({ speciesId: 'lily', sceneryId: 'waterfall', slotId: 'pool-1' }))).toBe(false);
    expect(store.get()).toBe(before);
    expect(controller.placementOptions('lily', 'japanese-garden')).toEqual([]); // no water slot here
  });

  it('keeps a plant already growing where its species is no longer offered, and lets a new seedling take its spot', () => {
    const old = makePlant({ id: 'old-lily', speciesId: 'lily', sceneryId: 'waterfall', slotId: 'ledge-1' });
    const { controller, store, to } = setup({ ...createDefaultState(T0), plants: [old] }, true);
    expect(controller.start(opts({ sceneryId: 'waterfall', slotId: 'shared-1' }))).toBe(true);
    to(25);
    expect(store.get().plants.map((p) => p.id)).toContain('old-lily');
    expect(controller.placementOptions('violet', 'waterfall').find((o) => o.slot.id === 'ledge-1')?.occupiedBy?.id).toBe('old-lily');
    expect(controller.start(opts({ sceneryId: 'waterfall', slotId: 'ledge-1' }))).toBe(true);
    expect(store.get().session?.displacedPlantId).toBe('old-lily');
  });
});
