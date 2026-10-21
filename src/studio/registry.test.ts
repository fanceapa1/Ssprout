import { describe, expect, it } from 'vitest';
import { collectSections, findEntry } from './registry';
import type { StudioEntry, StudioSection } from './types';

const entry = (id: string): StudioEntry => ({ id, label: id, w: 10, h: 10, render: () => {} });
const section = (id: string, entries: string[], order?: number): StudioSection => ({
  id,
  title: id.toUpperCase(),
  order,
  entries: entries.map(entry),
});

describe('studio registry', () => {
  it('flattens single and array exports, sorted by order then title', () => {
    const sections = collectSections({
      '/a.studio.ts': { default: section('b', ['x']) },
      '/b.studio.ts': { default: [section('a', ['x']), section('z', ['y'], 1)] },
    });
    expect(sections.map((s) => s.id)).toEqual(['z', 'a', 'b']);
  });

  it('rejects duplicate section ids and duplicate entry ids in a section', () => {
    expect(() =>
      collectSections({ '/a.studio.ts': { default: [section('a', []), section('a', [])] } }),
    ).toThrow(/duplicate studio section/);
    expect(() => collectSections({ '/a.studio.ts': { default: section('a', ['x', 'x']) } })).toThrow(
      /duplicate entry/,
    );
  });

  it('finds entries by full id or unambiguous bare id', () => {
    const sections = [section('a', ['one', 'shared']), section('b', ['shared'])];
    expect(findEntry(sections, 'a/shared')?.section.id).toBe('a');
    expect(findEntry(sections, 'one')?.entry.id).toBe('one');
    expect(findEntry(sections, 'shared')).toBeUndefined();
    expect(findEntry(sections, 'missing')).toBeUndefined();
  });

  it('discovers the real *.studio.ts files', async () => {
    const mods = import.meta.glob<StudioSection | StudioSection[]>('/src/**/*.studio.ts', {
      eager: true,
      import: 'default',
    });
    const sections = collectSections(
      Object.fromEntries(Object.entries(mods).map(([k, v]) => [k, { default: v }])),
    );
    expect(sections.length).toBeGreaterThan(0);
  });
});
