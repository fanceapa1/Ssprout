import { describe, expect, it } from 'vitest';
import { createEventBus } from '../core/events';
import { createDefaultState, createStore, reducer } from '../core/state';
import { gardenScene } from '../scene/geometry';
import { OASIS_WILDLIFE } from '../scenery/oasis/wildlife';
import { oasisScene } from '../scenery/oasis/geometry';
import type { Scenery } from '../scenery/types';
import { createViewport } from '../render/viewport';
import type { SystemContext } from '../render/types';
import { creatureDef, creaturesLoaded } from './creatures/registry';
import { createFaunaSystem } from './system';

/** The fauna system waits for the garden's creature chunk (ADR 0346); nothing here preloads it. */
describe('fauna system · creatures per garden', () => {
  const flower = { pollinators: true, habitats: ['meadow' as const], size: { w: 60, h: 90 }, anchor: { x: 0.5, y: 0.95 }, bloomColor: '#e8a7a9' };
  const ctxFor = (scenery: Pick<Scenery, 'id' | 'fauna'> | undefined, scene = gardenScene) => {
    const store = createStore(createDefaultState(0), reducer);
    return { viewport: createViewport(1600, 1000), store, bus: createEventBus(), clock: { now: () => 12 * 3600_000 }, scene, scenery, reducedMotion: false } as unknown as SystemContext;
  };

  it('starts once its garden is loaded; an init overtaken by another garden is dropped', async () => {
    expect(creaturesLoaded('oasis')).toBe(false);
    const system = createFaunaSystem({ species: () => flower, seed: 3 });
    const oasis = system.init!(ctxFor({ id: 'oasis', fauna: OASIS_WILDLIFE }, oasisScene));
    expect(oasis).toBeInstanceOf(Promise);
    expect(system.sim).toBeNull();
    // a switch back before the oasis landed: the Japanese garden wins
    const garden = system.init!(ctxFor(undefined));
    await Promise.all([oasis, garden]);
    expect(creatureDef('bunting')).toBeDefined();
    expect(system.sim).not.toBeNull();
    expect(system.sceneryId()).toBe('japanese-garden');
    for (let i = 0; i < 20; i++) system.update!({ t: i * 0.1, dt: 0.1, now: 12 * 3600_000 });
    expect(system.sim!.list().some((c) => c.kind === 'strider')).toBe(true);
    // loaded now: a switch to the oasis is synchronous
    expect(system.init!(ctxFor({ id: 'oasis', fauna: OASIS_WILDLIFE }, oasisScene))).toBeUndefined();
    expect(system.sceneryId()).toBe('oasis');
  });
});
