import { describe, expect, it } from 'vitest';
import { compatibleSlots, isCompatible } from '../core/placement';
import { FIXTURE_SPECIES, withFixtures } from '../dev/fixture-species';
import type { Range } from '../plants/biomes';
import { floraLookup, floraOf, growsIn, type SceneryBiome } from '../plants/flora';
import { allSpecies, getSpecies } from '../plants/registry';
import { TIERS, type SpeciesDef } from '../plants/types';
import { gardenScene } from '../scene/geometry';
import { SCENERY_IDS } from './ids';
import { getScenery, hasScenery, sceneries } from './registry';
import type { Scenery } from './types';

/**
 * Each scenery's flora (ADR 0250): which species it offers, from where they grow. Replaces the
 * old "every species can be planted in the garden" check (SPEC §2 step 4): a species offered in a
 * planting sheet must have a slot there, or choosing it leads nowhere.
 */

const REGISTERED: Scenery[] = SCENERY_IDS.filter(hasScenery).map(getScenery);
const RELEASED: Scenery[] = sceneries(new URLSearchParams());
const ids = (list: readonly { id: string }[]) => list.map((s) => s.id).sort();
const offered = (s: Scenery) => floraOf(allSpecies(), s.flora);

describe('the offer rule', () => {
  const range = (r: Partial<Range>): Range => ({ realms: ['japan'], biomes: ['wetland'], climates: ['cool-temperate'], ...r });
  const wild: SceneryBiome = { realm: 'japan', biomes: ['wetland', 'coast'], climate: 'cool-temperate', cultivated: false };

  it('offers a species whose realm, a biome and climate all match', () => {
    expect(growsIn('a', range({}), wild)).toBe(true);
    expect(growsIn('a', range({ realms: ['europe'] }), wild)).toBe(false);
    expect(growsIn('a', range({ biomes: ['alpine'] }), wild)).toBe(false);
    expect(growsIn('a', range({ climates: ['warm-temperate'] }), wild)).toBe(false);
  });

  it('a cultivated scenery also offers what is planted in its realm; a wild one does not', () => {
    const planted = range({ realms: [], biomes: [], climates: [], cultivatedIn: ['japan'] });
    expect(growsIn('a', planted, wild)).toBe(false);
    expect(growsIn('a', planted, { ...wild, cultivated: true })).toBe(true);
    expect(growsIn('a', planted, { ...wild, realm: 'europe', cultivated: true })).toBe(false);
  });

  it('`except` wins over the range and `also`; `also` adds a species the range leaves out', () => {
    expect(growsIn('a', range({}), { ...wild, except: ['a'] })).toBe(false);
    expect(growsIn('a', range({ realms: ['europe'] }), { ...wild, also: ['a'] })).toBe(true);
    expect(growsIn('a', range({}), { ...wild, also: ['a'], except: ['a'] })).toBe(false);
  });

  it('floraLookup keeps the given order and answers `grows` from the same list', () => {
    const list = [
      { id: 'b', range: range({}) },
      { id: 'a', range: range({}) },
      { id: 'c', range: range({ realms: ['europe'] }) },
    ];
    const flora = floraLookup(list, () => wild);
    expect(ids(flora.of('x'))).toEqual(['a', 'b']);
    expect(flora.of('x').map((s) => s.id)).toEqual(['b', 'a']);
    expect(flora.grows('a', 'x')).toBe(true);
    expect(flora.grows('c', 'x')).toBe(false);
  });
});

describe('every species has a range and a home', () => {
  it('each species has a wild range or is planted somewhere', () => {
    for (const s of allSpecies()) {
      expect(s.range, s.id).toBeDefined();
      expect(s.range.realms.length + (s.range.cultivatedIn?.length ?? 0), s.id).toBeGreaterThan(0);
    }
  });

  it('each species is offered by at least one scenery', () => {
    const homeless = allSpecies()
      .filter((sp) => !REGISTERED.some((s) => growsIn(sp.id, sp.range, s.flora)))
      .map((sp) => sp.id);
    expect(homeless).toEqual([]);
  });

  it('each species has a slot that fits it in every scenery that offers it', () => {
    for (const s of REGISTERED) {
      const homeless = offered(s)
        .filter((sp) => !s.geometry.slots.some((slot) => isCompatible(sp, slot)))
        .map((sp) => sp.id);
      expect(homeless, s.id).toEqual([]);
    }
  });

  it('every `also` and `except` id is a registered species', () => {
    for (const s of REGISTERED) {
      for (const id of [...(s.flora.also ?? []), ...(s.flora.except ?? [])]) expect(getSpecies(id), `${s.id}: ${id}`).toBeDefined();
    }
  });

  it('the dev fixture species are offered in every scenery', () => {
    for (const s of REGISTERED) {
      expect(ids(floraOf(withFixtures(allSpecies()), s.flora).filter((sp) => sp.id.startsWith('fx-'))), s.id).toEqual(ids(FIXTURE_SPECIES));
    }
  });
});

describe('each garden’s flora', () => {
  it('the Japanese garden offers exactly the 25 garden species (a regression pin)', () => {
    expect(ids(offered(getScenery('japanese-garden')))).toEqual([
      'anemone', 'azalea', 'balloon-flower', 'black-pine', 'camellia', 'chrysanthemum', 'cosmos', 'dandelion',
      'forget-me-not', 'ginkgo', 'hydrangea', 'japanese-iris', 'japanese-maple', 'lotus', 'maidenhair-fern',
      'plum-blossom', 'spider-lily', 'susuki-grass', 'tree-peony', 'violet', 'water-lily', 'weeping-cherry',
      'white-clover', 'wild-strawberry', 'wisteria',
    ]);
  });

  it('the waterfall shares exactly the five that grow wild in a mountain gorge', () => {
    // the art tasks add the waterfall's own species: extend this list with each one
    expect(ids(offered(getScenery('waterfall')))).toEqual(['japanese-maple', 'maidenhair-fern', 'susuki-grass', 'violet', 'wild-strawberry']);
  });

  describe.each(RELEASED.map((s) => [s.id, s] as const))('released: %s', (_, s) => {
    const flora = offered(s);

    it('offers 10 to 30 species', () => {
      expect(flora.length).toBeGreaterThanOrEqual(10);
      expect(flora.length).toBeLessThanOrEqual(30);
    });

    it('offers at least two species in each tier', () => {
      for (const t of TIERS) expect(flora.filter((sp) => sp.tier === t).length, `tier ${t}`).toBeGreaterThanOrEqual(2);
    });

    it('each of its slot habitats takes at least two species', () => {
      for (const habitat of new Set(s.geometry.slots.map((slot) => slot.habitat))) {
        const slots = s.geometry.slots.filter((slot) => slot.habitat === habitat);
        const takers = flora.filter((sp: SpeciesDef) => slots.some((slot) => isCompatible(sp, slot)));
        expect(takers.length, habitat).toBeGreaterThanOrEqual(2);
      }
    });

    it('has at least six species no other scenery offers', () => {
      const others = REGISTERED.filter((o) => o.id !== s.id);
      const own = flora.filter((sp) => !others.some((o) => growsIn(sp.id, sp.range, o.flora)));
      expect(own.length).toBeGreaterThanOrEqual(6);
    });
  });
});

describe('lotus (Q1)', () => {
  const lotus = () => {
    const def = getSpecies('lotus');
    if (!def) throw new Error('lotus missing from the registry');
    return def;
  };

  it('fits the two large open-water slots', () => {
    expect(compatibleSlots(lotus(), gardenScene.slots, []).map((o) => o.slot.id)).toEqual(['water-1', 'water-3']);
  });

  it('has no spot only when seedlings of sessions in progress hold both (the planting sheet then marks it full)', () => {
    expect(compatibleSlots(lotus(), gardenScene.slots, [], new Set(['water-1']))).toHaveLength(1);
    expect(compatibleSlots(lotus(), gardenScene.slots, [], new Set(['water-1', 'water-3']))).toEqual([]);
  });
});
