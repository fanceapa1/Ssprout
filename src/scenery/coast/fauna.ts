/**
 * The Greek coast's wildlife (ADR 0248): an empty unlock table until the phase 15 creatures and the
 * shared ones land. The sea is its still water (the geometry's default). docs/systems/scenery.md › Coast.
 */
import type { FaunaTable } from '../../core/fauna-unlocks';
import type { SceneryFauna } from '../../fauna/habitat';

export const COAST_FAUNA: FaunaTable = [];

export const COAST_WILDLIFE: SceneryFauna = { unlocks: COAST_FAUNA };
