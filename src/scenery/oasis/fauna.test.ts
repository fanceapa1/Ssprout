import { describe, expect, it } from 'vitest';
import { unlockedFauna, type FaunaSpecies, type FaunaTable } from '../../core/fauna-unlocks';
import { makePlant } from '../../core/testing';
import { creatureDef } from '../../fauna/creatures/registry';
import { rosterFor } from '../../fauna/roster';
import { OASIS_FAUNA } from './fauna';

const SPECIES: Record<string, FaunaSpecies> = {
  mint: { pollinators: false, habitats: ['meadow'] },
  flower: { pollinators: true, habitats: ['meadow'] },
};
const lookup = (id: string) => SPECIES[id];
const garden = (n: number, speciesId = 'mint') => ({
  plants: Array.from({ length: n }, (_, i) => makePlant({ id: `p${i}`, speciesId, sceneryId: 'oasis', slotId: `s${i}` })),
});
const unlocked = (n: number, speciesId?: string, table: FaunaTable = OASIS_FAUNA) => unlockedFauna(garden(n, speciesId), lookup, 'oasis', table).map((f) => f.id);

const OWN: Record<string, string> = {
  'house-bunting': 'bunting',
  'laughing-dove': 'dove',
  'violet-dropwing': 'dropwing',
  'sahara-frog': 'sahara-frog',
  hoopoe: 'hoopoe',
  gecko: 'gecko',
  'bee-eater': 'bee-eater',
  'white-stork': 'stork',
};

describe('the oasis’s unlock table', () => {
  it('has its eight creatures under their module kinds, unique ids, a line each', () => {
    const ids = OASIS_FAUNA.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [id, kind] of Object.entries(OWN)) expect(OASIS_FAUNA.find((f) => f.id === id)?.kind, id).toBe(kind);
    for (const f of OASIS_FAUNA) expect(f.arrival, f.id).toMatch(/^[A-Z].{10,}\.$/);
  });

  it('keeps the ids the oasis’s sound bed listens for (src/audio/params.ts)', () => {
    for (const id of ['laughing-dove', 'gecko', 'sahara-frog', 'swallows']) expect(ids()).toContain(id);
  });

  it('shares only what O0 allows, in its oasis form; no koi, pond frog, aka dragonfly, wagtail or firefly', () => {
    const shared = OASIS_FAUNA.filter((f) => !Object.values(OWN).includes(f.kind));
    expect(shared.map((f) => [f.id, f.kind, f.variant ?? null])).toEqual([
      ['striders', 'strider', 'margin'],
      ['leaf', 'leaf', 'katsura'],
      ['butterflies', 'butterfly', 'white'],
      ['bees', 'bee', null],
      ['swallowtail', 'butterfly', 'swallowtail'],
      ['swallows', 'swallow', null],
      ['heron', 'heron', null],
    ]);
    for (const f of OASIS_FAUNA) {
      expect(['koi', 'frog', 'dragonfly', 'bird', 'firefly'], f.id).not.toContain(f.kind);
      const variants = creatureDef(f.kind)?.variants;
      if (f.variant && variants) expect(variants, f.id).toContain(f.variant);
    }
  });

  it('the striders, the bunting and a golden leaf are there from the start, unannounced', () => {
    expect(unlocked(0)).toEqual(['striders', 'house-bunting', 'leaf']);
    expect(OASIS_FAUNA.filter((f) => !f.announce).map((f) => f.id)).toEqual(['striders', 'house-bunting', 'leaf']);
  });

  it.each([
    [2, 'laughing-dove'],
    [3, 'violet-dropwing'],
    [5, 'sahara-frog'],
    [8, 'hoopoe'],
    [10, 'gecko'],
    [14, 'bee-eater'],
    [17, 'swallows'],
    [20, 'white-stork'],
    [22, 'heron'],
  ])('%i plants bring %s (one fewer does not)', (n, id) => {
    expect(unlocked(n)).toContain(id);
    expect(unlocked(n - 1)).not.toContain(id);
  });

  it('no two plant counts bring two creatures at once', () => {
    const arrivals = Array.from({ length: 25 }, (_, n) => unlocked(n + 1).length - unlocked(n).length);
    expect(Math.max(...arrivals)).toBe(1);
  });

  it('the Sahara frog lives in the basin and needs no water plant; pollinators still bring butterflies and bees', () => {
    expect(unlocked(5)).toContain('sahara-frog');
    expect(unlocked(22)).not.toContain('butterflies');
    expect(unlocked(8, 'flower')).toEqual(expect.arrayContaining(['butterflies', 'bees', 'swallowtail']));
  });

  it('the gecko is night-only and the stork rare by their rules (their modules set the pacing)', () => {
    expect(OASIS_FAUNA.find((f) => f.id === 'gecko')!.rule).toMatch(/night/);
    expect(OASIS_FAUNA.find((f) => f.id === 'white-stork')!.rule).toMatch(/rare/);
  });

  it('rows whose creature is not painted yet are skipped by the roster; the painted ones are kept', () => {
    const r = rosterFor(unlockedFauna(garden(25), lookup, 'oasis', OASIS_FAUNA));
    const kinds = [...r.visitors, ...r.residents.keys()];
    for (const kind of kinds) expect(creatureDef(kind), kind).toBeDefined();
    for (const kind of Object.values(OWN)) expect(kinds.includes(kind), kind).toBe(creatureDef(kind) !== undefined);
    expect(r.residents.get('strider')).toBe(1);
    expect([...r.visitors]).toEqual(expect.arrayContaining(['swallow', 'heron']));
  });
});

function ids(): string[] {
  return OASIS_FAUNA.map((f) => f.id);
}
