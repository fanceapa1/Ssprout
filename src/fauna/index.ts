/**
 * Wildlife for the garden (docs/systems/fauna.md). `createFauna` returns the render System;
 * with `debug` it also installs `window.sprout.fauna` once the dev API exists.
 */
import { installFaunaDebug } from './dev';
import { createFaunaSystem, type FaunaSystem, type FaunaSystemOptions } from './system';

export { createFaunaSystem, type FaunaSystem, type FaunaSystemOptions } from './system';
export { installFaunaDebug } from './dev';

export function createFauna(opts: FaunaSystemOptions & { debug?: boolean }): FaunaSystem {
  const system = createFaunaSystem(opts);
  // main.ts installs window.sprout right after registering systems; extend it once that ran
  if (opts.debug) queueMicrotask(() => installFaunaDebug(system));
  return system;
}
