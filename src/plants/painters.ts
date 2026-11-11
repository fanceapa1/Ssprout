import { buildRegistry } from './build-registry';
import type { SpeciesDef } from './types';

/**
 * Every species with its painter, imported eagerly: the sprite worker's registry (ADR 0348).
 * The main thread uses `registry.ts`, whose painters load per species.
 */
const modules = import.meta.glob<{ default: SpeciesDef }>(
  ['./species/*.ts', '!./species/*.test.ts', '!./species/*.studio.ts'],
  { eager: true },
);

const painters = buildRegistry(modules);

export function getPainter(id: string): SpeciesDef | undefined {
  return painters.get(id);
}
