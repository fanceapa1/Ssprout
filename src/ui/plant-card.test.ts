import { describe, expect, it } from 'vitest';
import { createDefaultState, type GardenState } from '../core/state';
import { MIN, T0, makePlant, makePressed, makeSession } from '../core/testing';
import type { SpeciesDef } from '../plants/types';
import { plantStory, storyLines } from './plant-card';

/**
 * The plant card's words (SPEC §12a.9, ADR 0167): the story of a finished plant or a growing
 * seedling, including the plant it replaced — pressed into the herbarium once the new one bloomed,
 * or stepping aside while the seedling grows (it comes back if the session ends early).
 */

const SPECIES: Record<string, Partial<SpeciesDef>> = {
  violet: { name: 'Wood Violet', nativeName: 'Sumire', description: 'A small violet hush.' },
  clover: { name: 'White Clover', nativeName: 'Shirotsumekusa', description: 'Three leaves for patience.' },
  iris: { name: 'Japanese Iris', description: 'Violet sails.' },
  heather: { name: 'Heather', nativeName: 'Fraoch', nativeLang: 'gd', description: 'Purple on the moor.' },
};
const getSpecies = (id: string) => SPECIES[id] as SpeciesDef | undefined;

function garden(over: Partial<GardenState>): GardenState {
  return { ...createDefaultState(T0), ...over };
}

describe('plantStory and storyLines', () => {
  it('carries the native name’s language from the species (default romanised Japanese)', () => {
    const state = garden({ plants: [makePlant({ id: 'a', speciesId: 'violet' }), makePlant({ id: 'b', speciesId: 'heather', slotId: 'meadow-2' })] });
    expect(plantStory(state, 'a', T0, getSpecies)).toMatchObject({ nativeName: 'Sumire', nativeLang: 'ja-Latn' });
    expect(plantStory(state, 'b', T0, getSpecies)).toMatchObject({ nativeName: 'Fraoch', nativeLang: 'gd' });
  });

  it('a finished plant that took a pressed plant’s place names it, with its task', () => {
    const plant = makePlant({ id: 'p2', speciesId: 'violet', taskName: 'Essay', completedAt: T0 });
    const state = garden({ plants: [plant], pressed: [makePressed({ speciesId: 'clover', taskName: 'Kanji', removedAt: T0 })] });
    const story = plantStory(state, 'p2', T0 + MIN, getSpecies)!;
    expect(story).toMatchObject({ kind: 'finished', name: 'Wood Violet', task: 'Essay', replaced: { name: 'White Clover', task: 'Kanji' } });
    expect(storyLines(story).replaced).toBe('It took the place of a white clover (“Kanji”), now pressed in your herbarium.');
  });

  it('a pressed flower from another moment is not the one it replaced', () => {
    const plant = makePlant({ id: 'p2', completedAt: T0 });
    const state = garden({ plants: [plant], pressed: [makePressed({ removedAt: T0 - 5 * MIN })] });
    const story = plantStory(state, 'p2', T0, getSpecies)!;
    expect(story.replaced).toBeNull();
    expect(storyLines(story).replaced).toBeNull();
  });

  it('a seedling growing where a plant stood says it steps aside and comes back if the session ends', () => {
    const old = makePlant({ id: 'old', speciesId: 'iris', taskName: '  ' });
    const session = makeSession({ id: 's9', speciesId: 'violet', displacedPlantId: 'old', taskName: 'Botany' });
    const state = garden({ plants: [old], session });
    const story = plantStory(state, 's9', T0 + 5 * MIN, getSpecies)!;
    expect(story).toMatchObject({ kind: 'growing', replaced: { name: 'Japanese Iris', task: null } });
    // Japanese keeps its capital; a blank task is left out
    expect(storyLines(story).replaced).toBe('A Japanese iris steps aside for it; if you end this session, it comes back.');
  });

  it('a seedling on a free spot has no replaced line', () => {
    const state = garden({ session: makeSession({ id: 's1' }) });
    const story = plantStory(state, 's1', T0 + 5 * MIN, getSpecies)!;
    expect(story.replaced).toBeNull();
    expect(storyLines(story).facts[0]).toMatch(/^\d+% grown, /);
  });
});
