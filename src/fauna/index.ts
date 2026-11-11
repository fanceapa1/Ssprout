/**
 * Wildlife for the garden (docs/systems/fauna.md). `createFauna` returns the render System;
 * with `debug` it also installs `window.sprout.fauna` once the dev API exists.
 */
import { loadCreatures } from './creatures/registry';
import { installFaunaDebug } from './dev';
import { createFaunaSystem, type FaunaSystem, type FaunaSystemOptions } from './system';

export { createFaunaSystem, type FaunaSystem, type FaunaSystemOptions } from './system';
export { installFaunaDebug } from './dev';
export { loadCreatures } from './creatures/registry';

export function createFauna(opts: FaunaSystemOptions & { debug?: boolean }): FaunaSystem {
  const system = createFaunaSystem(opts);
  // main.ts installs window.sprout right after registering systems; extend it once that ran
  if (opts.debug) queueMicrotask(() => installFaunaDebug(system));
  return system;
}

/** Fetch a garden's creatures ahead of a switch (ADR 0346); a failed fetch is tried again by the switch. */
export function prefetchCreatures(sceneryId: string): void {
  loadCreatures(sceneryId).catch(() => {});
}
