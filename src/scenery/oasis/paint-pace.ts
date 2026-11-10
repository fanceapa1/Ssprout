/**
 * Pauses inside a run of small marks (ADR 0226, 0330): a loop of dry-brush strokes, flicks or
 * glazes asks `pace()` after each mark and yields when it says so. A pause adds no canvas call and
 * draws no number, so the painting stays the same, pixel for pixel. docs/systems/scenery.md › Oasis.
 */

/** Marks per part for a run of dry-brush strokes or small glazes: each is a wet layer dried apart. */
export const MARKS_PER_PART = 6;

/** True after every `n`th call: where a loop of small marks may pause. */
export function pacer(n = MARKS_PER_PART): () => boolean {
  let k = 0;
  return () => ++k % n === 0;
}
