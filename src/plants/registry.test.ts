import { describe, expect, it } from 'vitest';
import { EVERYWHERE } from './biomes';
import { speciesMeta } from '../build/species-meta';
import { loadPainter, painterReady } from './painter';
import { getPainter } from './painters';
import { allSpecies, buildRegistry, fromMeta, getSpecies, speciesByTier } from './registry';
import { fitsSize, reflects, TIERS, type SpeciesDef } from './types';

const stub = (id: string, extra: Partial<SpeciesDef> = {}): { default: SpeciesDef } => ({
  default: {
    id,
    name: id,
    range: EVERYWHERE,
    tier: 1,
    habitats: ['meadow'],
    sizeClass: 'small',
    size: { w: 10, h: 10 },
    anchor: { x: 0.5, y: 1 },
    description: '',
    bloomColor: '#ffffff',
    pollinators: false,
    draw: () => {},
    ...extra,
  },
});

describe('species registry', () => {
  it('discovers species files', () => {
    expect(allSpecies().length).toBeGreaterThan(0);
    expect(getSpecies('white-clover')?.tier).toBe(1);
    // the placeholder is a test fixture (src/dev), never a plant the player can pick
    expect(getSpecies('placeholder-sprout')).toBeUndefined();
    expect(getSpecies('nope')).toBeUndefined();
  });

  it('every species is well formed', () => {
    for (const s of allSpecies()) {
      expect(s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(TIERS).toContain(s.tier);
      expect(s.habitats.length).toBeGreaterThan(0);
      expect(s.bloomColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.anchor.x).toBeGreaterThanOrEqual(0);
      expect(s.anchor.x).toBeLessThanOrEqual(1);
      expect(s.anchor.y).toBeGreaterThanOrEqual(0);
      expect(s.anchor.y).toBeLessThanOrEqual(1);
    }
  });

  it('filters by tier', () => {
    for (const t of TIERS) expect(speciesByTier(t).every((s) => s.tier === t)).toBe(true);
  });

  it('buildRegistry rejects id/file mismatch and sorts by id', () => {
    expect(() => buildRegistry({ './species/a.ts': stub('b') })).toThrow(/file name/);
    const reg = buildRegistry({ './species/z.ts': stub('z'), './species/a.ts': stub('a') });
    expect([...reg.keys()]).toEqual(['a', 'z']);
  });

  it('metadata without draw becomes a lazy species (ADR 0348)', async () => {
    const { draw: _d, ...meta } = stub('a').default;
    const full = stub('a').default;
    const mods = fromMeta({ './species/a.ts': { default: meta as SpeciesDef }, './species/b.ts': stub('b') }, { './species/a.ts': () => Promise.resolve(full) });
    const a = mods['./species/a.ts']!.default;
    expect(painterReady(a)).toBe(false);
    expect(await loadPainter(a)).toBe(true);
    expect(painterReady(a)).toBe(true);
    expect(painterReady(mods['./species/b.ts']!.default)).toBe(true);
  });

  it("every species' metadata survives the build's JSON extraction unchanged", () => {
    for (const s of allSpecies()) {
      const { draw: _d, ...meta } = s;
      expect(speciesMeta(s as unknown as Record<string, unknown>)).toStrictEqual(meta);
    }
  });

  it('the worker registry holds every species with its painter', () => {
    for (const s of allSpecies()) expect(typeof getPainter(s.id)?.draw).toBe('function');
  });
});

describe('species helpers', () => {
  it('fitsSize compares size classes', () => {
    expect(fitsSize('small', 'tree')).toBe(true);
    expect(fitsSize('tree', 'large')).toBe(false);
    expect(fitsSize('medium', 'medium')).toBe(true);
  });

  it('reflects defaults to water/shore habitats', () => {
    expect(reflects(stub('a', { habitats: ['shore'] }).default)).toBe(true);
    expect(reflects(stub('a', { habitats: ['meadow'] }).default)).toBe(false);
    expect(reflects(stub('a', { habitats: ['meadow'], reflect: true }).default)).toBe(true);
  });
});
