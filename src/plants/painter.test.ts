import { describe, expect, it, vi } from 'vitest';
import type { Rng } from '../core/rng';
import type { Painter } from '../paint';
import { EVERYWHERE } from './biomes';
import { lazySpecies, loadPainter, painterReady } from './painter';
import type { SpeciesDef } from './types';

const meta = (id: string): Omit<SpeciesDef, 'draw'> => ({
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
});

describe('lazy species painters (ADR 0348)', () => {
  it('a full definition is always ready', async () => {
    const full: SpeciesDef = { ...meta('a'), draw: () => {} };
    expect(painterReady(full)).toBe(true);
    await expect(loadPainter(full)).resolves.toBe(true);
  });

  it('loads once, then draws with the full definition as `this`', async () => {
    const seen: unknown[] = [];
    const full: SpeciesDef = {
      ...meta('a'),
      draw(this: SpeciesDef) {
        seen.push(this);
      },
    };
    const load = vi.fn(() => Promise.resolve(full));
    const def = lazySpecies(meta('a'), load);
    expect(def.tier).toBe(1);
    expect(painterReady(def)).toBe(false);
    expect(() => def.draw({} as Painter, {} as Rng, { w: 1, h: 1, growth: 1 })).toThrow(/not loaded/);
    const [x, y] = [loadPainter(def), loadPainter(def)];
    expect(await x).toBe(true);
    expect(await y).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(painterReady(def)).toBe(true);
    def.draw({} as Painter, {} as Rng, { w: 1, h: 1, growth: 1 });
    expect(seen).toEqual([full]);
  });

  it('a failed load resolves false and is tried again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const full: SpeciesDef = { ...meta('a'), draw: () => {} };
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(full);
    const def = lazySpecies(meta('a'), load);
    expect(await loadPainter(def)).toBe(false);
    expect(painterReady(def)).toBe(false);
    expect(await loadPainter(def)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('rejects a module for another species', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = lazySpecies(meta('a'), () => Promise.resolve({ ...meta('b'), draw: () => {} }));
    expect(await loadPainter(def)).toBe(false);
    warn.mockRestore();
  });
});
