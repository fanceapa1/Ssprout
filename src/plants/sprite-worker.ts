/**
 * Plant sprite worker (docs/systems/plants.md › Sprites, ADR 0111): paints sprites off the main
 * thread into OffscreenCanvas with the same `paintSprite` the main thread uses, and transfers
 * the result back as an ImageBitmap. Species come from the registry plus the dev fixtures; a
 * species it does not know is answered with `unknown` and painted on the main thread instead.
 */
import { FIXTURE_SPECIES } from '../dev/fixture-species';
import { getSpecies } from './registry';
import { paintSprite, type WorkerReply, type WorkerRequest } from './sprites';
import type { SpeciesDef } from './types';

interface WorkerScope {
  postMessage(msg: WorkerReply, transfer?: Transferable[]): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<WorkerRequest>) => void): void;
}

const scope = self as unknown as WorkerScope;
const fixtures = new Map<string, SpeciesDef>(FIXTURE_SPECIES.map((s) => [s.id, s]));
const lookup = (id: string): SpeciesDef | undefined => getSpecies(id) ?? fixtures.get(id);

scope.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'render') return;
  const def = lookup(msg.speciesId);
  if (!def) {
    scope.postMessage({ type: 'error', id: msg.id, reason: 'unknown' });
    return;
  }
  try {
    const r = paintSprite(def, msg);
    if (!r || !('transferToImageBitmap' in r.canvas)) {
      scope.postMessage({ type: 'error', id: msg.id, reason: 'failed', message: 'no OffscreenCanvas' });
      return;
    }
    const bitmap = r.canvas.transferToImageBitmap();
    scope.postMessage({ type: 'done', id: msg.id, bitmap, bounds: r.bounds }, [bitmap]);
  } catch (err) {
    scope.postMessage({ type: 'error', id: msg.id, reason: 'failed', message: String(err) });
  }
});
