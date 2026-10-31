import { describe, expect, it } from 'vitest';
import { SCENERY_IDS } from '../core/sceneries';
import { pickNote, SPECIES_NOTES, speciesNote } from './notes';
import { allSpecies } from './registry';

/** Every text a note file holds: its note and its per-garden overrides. */
const texts = (): [string, string][] =>
  Object.entries(SPECIES_NOTES).flatMap(([id, n]) => [
    [id, n.note] as [string, string],
    ...Object.entries(n.in ?? {}).map(([s, t]) => [`${id} in ${s}`, t ?? ''] as [string, string]),
  ]);

describe('species notes (plant card, ADRs 0167, 0251)', () => {
  it('every registered species has a note on its place in Japanese gardens', () => {
    const missing = allSpecies().filter((s) => !speciesNote(s.id)).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it('no note is left for a species that does not exist', () => {
    const ids = new Set(allSpecies().map((s) => s.id));
    expect(Object.keys(SPECIES_NOTES).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('each note is two or three plain sentences, short enough for the card', () => {
    const problems: string[] = [];
    for (const [id, note] of texts()) {
      const sentences = note.split(/(?<=[.!?])\s+(?=[A-Z])/).length;
      if (sentences < 2 || sentences > 3) problems.push(`${id}: ${sentences} sentences`);
      if (note.length > 330) problems.push(`${id}: ${note.length} chars`);
      if (/!|\bvery\b|\bbeautiful\b|\bmagical\b/i.test(note)) problems.push(`${id}: loud words`);
    }
    expect(problems).toEqual([]);
  });

  it('a per-garden note names a scenery that exists', () => {
    const bad = Object.entries(SPECIES_NOTES).flatMap(([id, n]) =>
      Object.keys(n.in ?? {})
        .filter((s) => !(SCENERY_IDS as readonly string[]).includes(s))
        .map((s) => `${id}: ${s}`),
    );
    expect(bad).toEqual([]);
  });

  it('a garden without its own note gets the species note', () => {
    expect(speciesNote('violet', 'waterfall')).toBe(SPECIES_NOTES.violet!.note);
    expect(speciesNote('violet', 'japanese-garden')).toBe(speciesNote('violet'));
  });

  it('a garden with its own note gets that one', () => {
    const entry = { note: 'Everywhere.', in: { waterfall: 'By the falls.' } };
    expect(pickNote(entry, 'waterfall')).toBe('By the falls.');
    expect(pickNote(entry, 'japanese-garden')).toBe('Everywhere.');
    expect(pickNote(entry)).toBe('Everywhere.');
  });

  it('fixture species have none', () => {
    expect(speciesNote('fx-moss')).toBeNull();
    expect(speciesNote('fx-moss', 'waterfall')).toBeNull();
  });
});
