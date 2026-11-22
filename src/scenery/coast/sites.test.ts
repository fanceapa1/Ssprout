import { describe, expect, it } from 'vitest';
import { isCompatible } from '../../core/placement';
import { SCENERY_IDS } from '../../core/sceneries';
import { floraOf } from '../../plants/flora';
import { allSpecies } from '../../plants/registry';
import { getScenery } from '../registry';
import { COAST_SLOTS } from './slots';

/** Each coast species against the coast slots it fits (ADR 0383; docs/research/coast-biome.md §2, §4). */
const FITS: Record<string, string[]> = {
  'aleppo-pine': ['scrub-1'],
  caper: ['path-1', 'path-2', 'path-3', 'path-4', 'path-5', 'wall-1', 'wall-2', 'wall-3', 'wall-5', 'crack-1', 'wall-4', 'crack-2', 'splash-1', 'splash-2', 'splash-3', 'shelf-1'],
  cyclamen: [
    'top-1', 'top-2', 'top-3', 'mid-1', 'mid-2', 'mid-3', 'mid-4', 'mid-5', 'low-1', 'low-2', 'low-3', 'low-4',
    'scrub-1', 'scrub-3', 'scrub-4', 'scrub-5', 'scrub-6', 'wall-1', 'wall-2', 'wall-3', 'wall-5', 'crack-1', 'wall-4', 'crack-2',
  ],
  cypress: ['top-1', 'mid-1'],
  cystoseira: ['shallows-1', 'shallows-2', 'shallows-4', 'shallows-6', 'pool-2'],
  grapevine: ['top-1', 'mid-1', 'scrub-1'],
  'ice-plant': [
    'top-1', 'top-2', 'top-3', 'mid-1', 'mid-2', 'mid-3', 'mid-4', 'mid-5', 'low-1', 'low-2', 'low-3', 'low-4',
    'path-1', 'path-2', 'path-3', 'path-4', 'path-5', 'wall-1', 'wall-2', 'wall-3', 'wall-5', 'crack-1', 'wall-4', 'crack-2',
  ],
  'jerusalem-sage': ['top-1', 'top-2', 'mid-1', 'low-3', 'low-4', 'scrub-1', 'scrub-3', 'shelf-1'],
  lavender: ['top-1', 'top-2', 'mid-1', 'low-3', 'low-4'],
  oleander: ['beach-2', 'scrub-1'],
  olive: ['top-1', 'scrub-1'],
  'peacocks-tail': ['shallows-1', 'shallows-2', 'shallows-3', 'shallows-4', 'shallows-5', 'shallows-6', 'pool-1', 'pool-2', 'pool-3'],
  pomegranate: ['top-1', 'mid-1', 'scrub-1'],
  posidonia: ['shallows-1'],
  'rock-rose': ['path-1', 'path-2', 'path-3', 'path-4', 'path-5', 'scrub-1', 'scrub-3', 'scrub-4', 'scrub-5', 'scrub-6', 'shelf-1'],
  'rock-samphire': ['beach-1', 'beach-2', 'beach-3', 'beach-4', 'beach-5', 'scrub-2', 'splash-1', 'splash-2', 'splash-3', 'shelf-1'],
  'sea-daffodil': ['beach-2', 'beach-3'],
  'sea-holly': ['beach-1', 'beach-2', 'beach-3', 'beach-4', 'beach-5', 'scrub-2'],
  'sea-lavender': ['splash-1', 'splash-2', 'splash-3'],
  'southern-maidenhair': ['wall-1', 'wall-2', 'wall-3', 'wall-5', 'crack-1', 'wall-4', 'crack-2'],
  'tree-spurge': ['scrub-1'],
};

describe('the coast’s sites (ADR 0383)', () => {
  it('marks every rock and beach slot with the place it is: a wall, the bastion’s ledge, a rock in the sea, the beach', () => {
    const site = (id: string) => COAST_SLOTS.find((s) => s.id === id)!.site;
    for (const s of COAST_SLOTS) {
      if (s.id.startsWith('wall-') || s.id.startsWith('crack-')) expect(s.site, s.id).toBe('wall');
      else if (s.id.startsWith('splash-')) expect(s.site, s.id).toBe('sea-rock');
      else if (s.habitat === 'shore') expect(s.site, s.id).toBe('beach');
      else if (s.id !== 'shelf-1') expect(s.site, s.id).toBeUndefined();
    }
    expect(site('shelf-1')).toBe('ledge');
    // scrub-2 lies on the beach's sand at its west end: a beach slot under its old id
    expect(COAST_SLOTS.find((s) => s.id === 'scrub-2')).toMatchObject({ habitat: 'shore', site: 'beach' });
  });

  it('fits each species it offers only where it grows (docs/research/coast-biome.md)', () => {
    const offered = floraOf(allSpecies(), getScenery('coast').flora);
    const fits = Object.fromEntries(offered.map((d) => [d.id, COAST_SLOTS.filter((s) => isCompatible(d, s)).map((s) => s.id)]));
    expect(fits).toEqual(FITS);
  });

  it('lets only sea plants onto the splash rocks and only beach plants onto the beach', () => {
    const on = (site: string) => Object.keys(FITS).filter((id) => FITS[id]!.some((slot) => COAST_SLOTS.find((s) => s.id === slot)!.site === site));
    expect(on('sea-rock')).toEqual(['caper', 'rock-samphire', 'sea-lavender']);
    expect(on('beach')).toEqual(['oleander', 'rock-samphire', 'sea-daffodil', 'sea-holly']);
    expect(on('ledge')).toEqual(['caper', 'jerusalem-sage', 'rock-rose', 'rock-samphire']);
  });

  it('leaves the other gardens’ slots without a site, so their plants fit as before', () => {
    for (const id of SCENERY_IDS.filter((x) => x !== 'coast')) {
      for (const s of getScenery(id).geometry.slots) expect(s.site, `${id} ${s.id}`).toBeUndefined();
    }
  });
});
