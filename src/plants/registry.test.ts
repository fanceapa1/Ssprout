import { describe, expect, it } from 'vitest';
import { allSpecies, buildRegistry, getSpecies, speciesByTier } from './registry';
import { fitsSize, reflects, TIERS, type SpeciesDef } from './types';

const stub = (id: string, extra: Partial<SpeciesDef> = {}): { default: SpeciesDef } => ({
  default: {
    id,
    name: id,
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
    expect(getSpecies('placeholder-sprout')?.tier).toBe(1);
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
