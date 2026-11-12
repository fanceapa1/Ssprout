import { describe, expect, it } from 'vitest';
import { unlockedFauna, type FaunaSpecies, type FaunaTable } from '../../core/fauna-unlocks';
import { makePlant } from '../../core/testing';
import { creatureDef, loadAllCreatures } from '../../fauna/creatures/registry';
import { rosterFor } from '../../fauna/roster';
import { faunaTable } from '../fauna';
import { COAST } from '.';
import { COAST_FAUNA } from './fauna';

const SPECIES: Record<string, FaunaSpecies> = {
  thyme: { pollinators: false, habitats: ['meadow'] },
  flower: { pollinators: true, habitats: ['meadow'] },
};
const lookup = (id: string) => SPECIES[id];
const garden = (n: number, speciesId = 'thyme', flowers = 0) => ({
  plants: Array.from({ length: n }, (_, i) => makePlant({ id: `p${i}`, speciesId: i < flowers ? 'flower' : speciesId, sceneryId: 'coast', slotId: `s${i}` })),
});
const unlocked = (n: number, speciesId?: string, table: FaunaTable = COAST_FAUNA) => unlockedFauna(garden(n, speciesId), lookup, 'coast', table).map((f) => f.id);

/** The coast's own creatures, by row id → the kind its art task creates (`src/fauna/creatures/<kind>.ts`). */
const OWN: Record<string, string> = {
  'island-cat': 'cat',
  gull: 'gull',
  cicada: 'cicada',
  'green-lizard': 'green-lizard',
  'rock-crab': 'rock-crab',
  'blue-rock-thrush': 'rock-thrush',
  goats: 'goat',
  tortoise: 'tortoise',
  damselfish: 'damselfish',
  'scops-owl': 'scops-owl',
  octopus: 'octopus',
  dolphins: 'dolphin',
};

// every garden's creatures (ADR 0346)
await loadAllCreatures();

describe('the coast’s unlock table', () => {
  it('is the scenery’s and the quiet line’s', () => {
    expect(COAST.fauna.unlocks).toBe(COAST_FAUNA);
    expect(faunaTable('coast')).toBe(COAST_FAUNA);
  });

  it('has its twelve creatures under their module kinds, unique ids, a line each', () => {
    const ids = COAST_FAUNA.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [id, kind] of Object.entries(OWN)) expect(COAST_FAUNA.find((f) => f.id === id)?.kind, id).toBe(kind);
    for (const f of COAST_FAUNA) {
      expect(f.arrival, f.id).toMatch(/^[A-Z].{10,}\.$/);
      expect(f.kind, f.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('shares what G0 allows, in its coast form; no leaf, dropwing, koi, frog, strider, firefly or the oasis’s birds', () => {
    const shared = COAST_FAUNA.filter((f) => !Object.values(OWN).includes(f.kind));
    expect(shared.map((f) => [f.id, f.kind, f.variant ?? null])).toEqual([
      ['butterflies', 'butterfly', 'white'],
      ['bees', 'bee', null],
      ['swallows', 'swallow', null],
      ['swallowtail', 'butterfly', 'swallowtail'],
      ['hoopoe', 'hoopoe', null],
      ['gecko', 'gecko', 'house'],
      ['heron', 'heron', null],
    ]);
    for (const f of COAST_FAUNA) {
      expect(['leaf', 'dropwing', 'koi', 'frog', 'strider', 'firefly', 'dove', 'bunting', 'bee-eater', 'stork', 'sahara-frog', 'bird'], f.id).not.toContain(f.kind);
      const variants = creatureDef(f.kind)?.variants;
      if (f.variant && variants) expect(variants, f.id).toContain(f.variant);
    }
    // not in the table (the owner may want them later)
    for (const kind of ['hawk-moth', 'shearwater', 'turtle']) expect(COAST_FAUNA.some((f) => f.kind.includes(kind))).toBe(false);
  });

  it('the island cat is there from the start, unannounced', () => {
    expect(unlocked(0)).toEqual(['island-cat']);
    expect(COAST_FAUNA.filter((f) => !f.announce).map((f) => f.id)).toEqual(['island-cat']);
  });

  it.each([
    [1, 'gull'],
    [2, 'cicada'],
    [3, 'green-lizard'],
    [5, 'rock-crab'],
    [7, 'swallows'],
    [8, 'blue-rock-thrush'],
    [9, 'goats'],
    [10, 'tortoise'],
    [11, 'damselfish'],
    [12, 'scops-owl'],
    [13, 'hoopoe'],
    [14, 'gecko'],
    [16, 'octopus'],
    [18, 'heron'],
    [20, 'dolphins'],
  ])('%i plants bring %s (one fewer does not)', (n, id) => {
    expect(unlocked(n)).toContain(id);
    expect(unlocked(n - 1)).not.toContain(id);
  });

  it.each([
    [4, 'butterflies'],
    [6, 'bees'],
    [8, 'swallowtail'],
  ])('%i pollinator flowers bring %s', (n, id) => {
    const rows = (k: number) => unlockedFauna(garden(25, 'thyme', k), lookup, 'coast', COAST_FAUNA).map((f) => f.id);
    expect(rows(n)).toContain(id);
    expect(rows(n - 1)).not.toContain(id);
  });

  it('no plant count brings two creatures at once', () => {
    const arrivals = Array.from({ length: 25 }, (_, n) => unlocked(n + 1).length - unlocked(n).length);
    expect(Math.max(...arrivals)).toBe(1);
    // the pollinator rows sit at counts no plant row uses, but for the swallowtail's 8 (the thrush's): only an all-flower garden brings both
    const all = Array.from({ length: 25 }, (_, n) => [n + 1, unlocked(n + 1, 'flower').length - unlocked(n, 'flower').length] as const);
    expect(all.filter(([, k]) => k > 1)).toEqual([[8, 2]]);
  });

  it('the scops owl and the gecko are night-only and the octopus, heron and dolphins rare by their rules (their modules set the pacing)', () => {
    for (const id of ['scops-owl', 'gecko']) expect(COAST_FAUNA.find((f) => f.id === id)!.rule, id).toMatch(/night/);
    for (const id of ['octopus', 'heron', 'dolphins']) expect(COAST_FAUNA.find((f) => f.id === id)!.rule, id).toMatch(/rare/);
  });

  it('rows whose creature is not painted yet are skipped by the roster; the shared ones that are come', () => {
    const r = rosterFor(unlockedFauna(garden(25, 'flower'), lookup, 'coast', COAST_FAUNA));
    const kinds = [...r.visitors, ...r.residents.keys()];
    for (const kind of kinds) expect(creatureDef(kind), kind).toBeDefined();
    for (const kind of Object.values(OWN)) expect(kinds.includes(kind), kind).toBe(creatureDef(kind) !== undefined);
    expect([...r.visitors]).toEqual(expect.arrayContaining(['butterfly', 'bee', 'swallow', 'heron']));
    expect(r.variants.get('butterfly')).toEqual(['white', 'swallowtail']);
  });
});
