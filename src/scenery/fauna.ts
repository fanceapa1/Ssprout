/**
 * Every scenery's unlock table by id, without loading the sceneries' painting (the quiet line's
 * arrival lines). The sceneries carry the same tables in `Scenery.fauna.unlocks` (ADR 0248).
 */
import type { FaunaTable } from '../core/fauna-unlocks';
import type { SceneryId } from './ids';
import { JAPANESE_FAUNA } from './japanese-garden/fauna';
import { WATERFALL_FAUNA } from './waterfall/fauna';

const TABLES: Readonly<Record<SceneryId, FaunaTable>> = {
  'japanese-garden': JAPANESE_FAUNA,
  waterfall: WATERFALL_FAUNA,
};

export function faunaTable(sceneryId: SceneryId): FaunaTable {
  return TABLES[sceneryId] ?? [];
}
