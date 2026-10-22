import { describe, expect, it } from 'vitest';
import { SPECIES_NOTES, speciesNote } from './notes';
import { allSpecies } from './registry';

describe('species notes (plant card, ADR 0167)', () => {
  it('every registered species has a note on its place in Japanese gardens', () => {
    const missing = allSpecies().filter((s) => !speciesNote(s.id)).map((s) => s.id);
    expect(missing).toEqual([]);
    expect(allSpecies()).toHaveLength(25);
  });

  it('no note is left for a species that does not exist', () => {
    const ids = new Set(allSpecies().map((s) => s.id));
    expect(Object.keys(SPECIES_NOTES).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('each note is two or three plain sentences, short enough for the card', () => {
    const problems: string[] = [];
    for (const [id, note] of Object.entries(SPECIES_NOTES)) {
      const sentences = note.split(/(?<=[.!?])\s+(?=[A-Z])/).length;
      if (sentences < 2 || sentences > 3) problems.push(`${id}: ${sentences} sentences`);
      if (note.length > 330) problems.push(`${id}: ${note.length} chars`);
      if (/!|\bvery\b|\bbeautiful\b|\bmagical\b/i.test(note)) problems.push(`${id}: loud words`);
    }
    expect(problems).toEqual([]);
  });

  it('fixture species have none', () => {
    expect(speciesNote('fx-moss')).toBeNull();
  });
});
