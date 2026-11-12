import type { SpeciesDef } from './types';

/**
 * Lazy species painters on the main thread (ADR 0348). In a production build the main-thread
 * registry holds each species' metadata only; its `draw` needs the species' painter chunk, which
 * `loadPainter` imports once. Workers, tests, the dev server and the `?fixtures` species hold
 * full definitions, and `painterReady` is always true for them.
 */

type Load = () => Promise<SpeciesDef>;

interface Handle {
  full: SpeciesDef | null;
  load: Load;
  pending: Promise<boolean> | null;
}

const handles = new WeakMap<SpeciesDef, Handle>();

/** A definition from metadata whose `draw` runs the painter `load` brings, once it has landed. */
export function lazySpecies(meta: Omit<SpeciesDef, 'draw'>, load: Load): SpeciesDef {
  const h: Handle = { full: null, load, pending: null };
  const def: SpeciesDef = {
    ...meta,
    draw(p, rng, opts) {
      const full = h.full;
      if (!full) throw new Error(`species "${meta.id}": painter not loaded`);
      full.draw.call(full, p, rng, opts);
    },
  };
  handles.set(def, h);
  return def;
}

/** True when `def.draw` can paint now. */
export function painterReady(def: SpeciesDef): boolean {
  const h = handles.get(def);
  return !h || h.full !== null;
}

/** Load the species' painter (once). Resolves false when the chunk failed; a later call tries again. */
export function loadPainter(def: SpeciesDef): Promise<boolean> {
  const h = handles.get(def);
  if (!h || h.full) return Promise.resolve(true);
  h.pending ??= h
    .load()
    .then((full) => {
      if (!full || full.id !== def.id) throw new Error(`species "${def.id}": its painter module has no matching default export`);
      h.full = full;
      return true;
    })
    .catch((err: unknown) => {
      h.pending = null;
      console.warn(`[plants] painter for "${def.id}" failed to load`, err);
      return false;
    });
  return h.pending;
}
