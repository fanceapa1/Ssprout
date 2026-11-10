/**
 * A garden's painters behind a handle (ADR 0341): loaded from their own chunk the first time a
 * paint has to run, then held. docs/systems/scenery.md › Lazy painters.
 */

export interface Painters<T> {
  /** the painters once loaded, else null */
  get(): T | null;
  /** load them (once; a failed load may be tried again) */
  load(): Promise<T>;
}

/** Painters from a dynamic import. A load that resolves empty (the page is reloading, ADR 0230) never settles. */
export function lazyPainters<T>(load: () => Promise<T | undefined>): Painters<T> {
  let value: T | null = null;
  let pending: Promise<T> | null = null;
  return {
    get: () => value,
    load: () =>
      (pending ??= load().then(
        (v) => (v === undefined ? new Promise<T>(() => {}) : (value = v)),
        (err: unknown) => {
          pending = null;
          throw err;
        },
      )),
  };
}

/** Painters that are already here (the studio's own scenes, tests). */
export function readyPainters<T>(value: T): Painters<T> {
  return { get: () => value, load: () => Promise.resolve(value) };
}

/** The painters, or an error naming whose they are when they have not been loaded yet. */
export function loaded<T>(painters: Painters<T>, whose: string): T {
  const v = painters.get();
  if (!v) throw new Error(`${whose}: painters not loaded (await painters.load() first)`);
  return v;
}
