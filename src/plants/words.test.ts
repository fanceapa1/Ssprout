import { describe, expect, it } from 'vitest';
import { SCENERY_IDS } from '../core/sceneries';
import { getScenery, hasScenery } from '../scenery/registry';
import { growsIn } from './flora';
import { allSpecies } from './registry';
import { speciesWords, type SpeciesDef } from './types';

/** A shared species' card words per garden (ADR 0385): each falls back to the species' own. */

const vine = {
  nativeName: 'Dalia',
  nativeLang: 'ary-Latn',
  description: 'Grapevine — palm posts.',
  in: { coast: { nativeName: 'Ampeli', nativeLang: 'el-Latn', description: 'Grapevine — a terrace roof.' }, waterfall: { description: 'Grapevine — by the falls.' } },
} satisfies Pick<SpeciesDef, 'nativeName' | 'nativeLang' | 'description' | 'in'>;

describe('speciesWords', () => {
  it('gives a garden its own native name, its language and line', () => {
    expect(speciesWords(vine, 'coast')).toEqual({ nativeName: 'Ampeli', nativeLang: 'el-Latn', description: 'Grapevine — a terrace roof.' });
  });

  it('falls back to the species’ own words for a garden without any, or with no garden', () => {
    const own = { nativeName: 'Dalia', nativeLang: 'ary-Latn', description: 'Grapevine — palm posts.' };
    expect(speciesWords(vine, 'oasis')).toEqual(own);
    expect(speciesWords(vine)).toEqual(own);
  });

  it('falls back word by word: a garden line keeps the species’ native name and its language', () => {
    expect(speciesWords(vine, 'waterfall')).toEqual({ nativeName: 'Dalia', nativeLang: 'ary-Latn', description: 'Grapevine — by the falls.' });
    expect(speciesWords({ description: 'Violet.', nativeName: 'Sumire' }, 'coast')).toEqual({ nativeName: 'Sumire', nativeLang: 'ja-Latn', description: 'Violet.' });
  });
});

describe('every species’ garden words', () => {
  const entries = allSpecies().flatMap((s) => Object.entries(s.in ?? {}).map(([g, w]) => ({ s, g, w: w! })));

  it('name a garden that exists and offers the species', () => {
    const bad = entries
      .filter(({ s, g }) => !(SCENERY_IDS as readonly string[]).includes(g) || !hasScenery(g as never) || !growsIn(s.id, s.range, getScenery(g as never).flora))
      .map(({ s, g }) => `${s.id} in ${g}`);
    expect(bad).toEqual([]);
  });

  it('keep the card’s rules: a native name with its language, a line under 80 characters led by the name', () => {
    const bad: string[] = [];
    for (const { s, g, w } of entries) {
      if (w.nativeName !== undefined && (w.nativeName.length <= 2 || !w.nativeLang)) bad.push(`${s.id} in ${g}: native name`);
      if (w.description !== undefined && (w.description.length <= 10 || w.description.length >= 80)) bad.push(`${s.id} in ${g}: line length`);
      if (w.description !== undefined && !w.description.toLowerCase().startsWith(`${s.name.toLowerCase()} — `)) bad.push(`${s.id} in ${g}: line lead`);
      if (w.description !== undefined && /!/.test(w.description)) bad.push(`${s.id} in ${g}: loud`);
    }
    expect(bad).toEqual([]);
  });
});
