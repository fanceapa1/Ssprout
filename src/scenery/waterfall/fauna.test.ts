import { describe, expect, it } from 'vitest';
import { unlockedFauna, type FaunaSpecies } from '../../core/fauna-unlocks';
import { makePlant } from '../../core/testing';
import { creatureDef } from '../../fauna/creatures/registry';
import { rosterFor } from '../../fauna/roster';
import { WATERFALL_FAUNA } from './fauna';

const SPECIES: Record<string, FaunaSpecies> = {
  fern: { pollinators: false, habitats: ['rock'] },
  flower: { pollinators: true, habitats: ['meadow'] },
};
const lookup = (id: string) => SPECIES[id];
const garden = (n: number, speciesId = 'fern') => ({
  plants: Array.from({ length: n }, (_, i) => makePlant({ id: `p${i}`, speciesId, sceneryId: 'waterfall', slotId: `s${i}` })),
});
const unlocked = (n: number, speciesId?: string) => unlockedFauna(garden(n, speciesId), lookup, 'waterfall', WATERFALL_FAUNA).map((f) => f.id);

describe('the waterfall’s unlock table', () => {
  it('has its own creatures and the shared ones, unique ids, a line each', () => {
    const ids = WATERFALL_FAUNA.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kind of ['dipper', 'damselfly', 'iwana', 'sawagani', 'kajika', 'iwatsubame', 'firefly', 'yamasemi']) {
      expect(WATERFALL_FAUNA.some((f) => f.kind === kind), kind).toBe(true);
    }
    for (const f of WATERFALL_FAUNA) expect(f.arrival, f.id).toMatch(/^[A-Z].{10,}\.$/);
  });

  it('shares only what lives in a gorge, in its gorge form; no koi, lily-pad frog or garden swallows', () => {
    const shared = Object.fromEntries(WATERFALL_FAUNA.filter((f) => creatureDef(f.kind) && f.kind !== 'bee' && f.kind !== 'heron').map((f) => [f.kind, f.variant]));
    expect(shared).toEqual({ strider: 'margin', leaf: 'maple', butterfly: 'swallowtail', dragonfly: 'aka', bird: 'wagtail' });
    for (const f of WATERFALL_FAUNA) {
      expect(['koi', 'frog', 'swallow']).not.toContain(f.kind);
      const variants = creatureDef(f.kind)?.variants;
      if (f.variant && variants) expect(variants, f.id).toContain(f.variant);
    }
  });

  it('the dipper, striders and a maple leaf are there from the start, unannounced', () => {
    expect(unlocked(0)).toEqual(['striders', 'dipper', 'leaf']);
    expect(WATERFALL_FAUNA.filter((f) => !f.announce).map((f) => f.id)).toEqual(['striders', 'dipper', 'leaf']);
  });

  it.each([
    [2, 'damselfly'],
    [3, 'iwana-1'],
    [5, 'dragonfly'],
    [6, 'wagtail'],
    [7, 'iwana-2'],
    [8, 'sawagani'],
    [10, 'kajika'],
    [14, 'iwatsubame'],
    [16, 'fireflies'],
    [18, 'heron'],
    [20, 'yamasemi'],
  ])('%i plants bring %s (one fewer does not)', (n, id) => {
    expect(unlocked(n)).toContain(id);
    expect(unlocked(n - 1)).not.toContain(id);
  });

  it('the kajika sits on stones and needs no water plant; pollinators still bring butterflies and bees', () => {
    expect(unlocked(10)).toContain('kajika');
    expect(unlocked(20)).not.toContain('butterflies');
    expect(unlocked(6, 'flower')).toEqual(expect.arrayContaining(['butterflies', 'bees']));
  });

  it('rows whose creature is not painted yet are skipped by the roster', () => {
    const r = rosterFor(WATERFALL_FAUNA);
    for (const kind of [...r.visitors, ...r.residents.keys()]) expect(creatureDef(kind), kind).toBeDefined();
    expect(r.variants.get('dragonfly')).toEqual(['aka']);
    expect(r.residents.get('strider')).toBe(1);
  });
});
