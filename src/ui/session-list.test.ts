import { describe, expect, it } from 'vitest';
import { compareSessionRows } from './session-list';

/** The order of the sessions in progress in the Study section (ADR 0156, devlog 25). */
describe('compareSessionRows', () => {
  const row = (id: string, taskName: string, startedAt = 1000) => ({ id, taskName, startedAt });

  it('lists the oldest start first, so a row never moves on a switch', () => {
    const rows = [row('a', 'Essay', 3000), row('b', 'Biology', 1000), row('c', 'Art', 2000)];
    expect(rows.sort(compareSessionRows).map((r) => r.taskName)).toEqual(['Biology', 'Art', 'Essay']);
  });

  it('sessions started in the same instant follow their names, not their random ids', () => {
    // the ids end in a random tail: every arrangement of them gives the same order
    const ids = ['session-x-0f3a1', 'session-x-9zz00', 'session-x-00b7c'];
    for (const perm of [
      [0, 1, 2],
      [2, 0, 1],
      [1, 2, 0],
    ]) {
      const rows = [row(ids[perm[0]!]!, 'Task 3'), row(ids[perm[1]!]!, 'Task 1'), row(ids[perm[2]!]!, 'Task 2')];
      expect(rows.sort(compareSessionRows).map((r) => r.taskName)).toEqual(['Task 1', 'Task 2', 'Task 3']);
    }
  });

  it('numbers in names read in order (Task 2 before Task 10); equal names fall back to the id', () => {
    const rows = [row('b', 'Task 10'), row('z', 'Task 2'), row('a', 'Task 2')];
    expect(rows.sort(compareSessionRows).map((r) => `${r.taskName}/${r.id}`)).toEqual(['Task 2/a', 'Task 2/z', 'Task 10/b']);
  });
});
