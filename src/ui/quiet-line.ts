import type { UIContext } from './context';
import { h, setText } from './dom';
import { faunaSeenIn, faunaSeenKey } from '../core/fauna-unlocks';
import type { SceneryId } from '../core/sceneries';
import { faunaArrivalLine } from './format';

/**
 * The quiet line near the top of the garden: one sentence at a time for ~6 s, then it fades.
 * - Completion: "Your Japanese Iris for “Biology ch. 4” has bloomed." (`say`, jumps the queue).
 * - Fauna arrivals (SPEC §4): the fauna system emits `fauna:arrived` the first time a newly
 *   unlocked creature is actually in view (ADR 0120); the line is queued, shown when the garden
 *   is calm, and recorded then with `controller.announceFauna(id, sceneryId)` in the garden it
 *   was seen in (state.faunaSeen, namespaced: `faunaSeenKey`).
 * Lines wait while a sheet or placement is open, and for `hold(ms)`.
 */
export interface QuietLine {
  readonly el: HTMLElement;
  /** show anything queued now that the garden may be calm again */
  check(): void;
  /** show a line next (before any queued arrivals) */
  say(text: string, kind?: string): void;
  /** delay lines for `ms` (e.g. while a plant finishes blooming) */
  hold(ms: number): void;
  current(): string | null;
  dispose(): void;
}

const SHOW_MS = 6000;
const FADE_MS = 900;
const GAP_MS = 1400;

interface Item {
  kind: string;
  text: string;
  faunaId?: string;
  sceneryId?: SceneryId;
}

export function createQuietLine(ctx: UIContext): QuietLine {
  const { store, bus, controller } = ctx.deps;
  const text = h('span.line-text');
  const el = h('p.quiet-line', { role: 'status', 'aria-live': 'polite' }, text);
  const queue: Item[] = [];
  let current: Item | null = null;
  let holdUntil = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let announcing: string | null = null;
  const same = (q: Item | null, sceneryId: SceneryId, id: string) => q?.faunaId === id && q.sceneryId === sceneryId;

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers = timers.filter((x) => x !== t);
      fn();
    }, ms);
    timers.push(t);
  };

  const calm = () => ctx.mode() === 'garden' && ctx.openDialogs().length === 0;

  const record = (sceneryId: SceneryId, id: string) => {
    if (faunaSeenIn(store.get(), sceneryId, id)) return;
    announcing = faunaSeenKey(sceneryId, id);
    controller.announceFauna(id, sceneryId);
    announcing = null;
  };

  function enqueueFauna(sceneryId: SceneryId, id: string): void {
    if (queue.some((q) => same(q, sceneryId, id)) || same(current, sceneryId, id)) return;
    const line = faunaArrivalLine(sceneryId, id);
    // silent creatures (water striders) are there from the start: nothing to say or record (the UI
    // never writes state on its own at boot)
    if (!line) return;
    queue.push({ kind: 'fauna', text: line, faunaId: id, sceneryId });
  }

  function next(): void {
    if (current || queue.length === 0) return;
    const wait = holdUntil - performance.now();
    if (wait > 0) return later(next, wait + 10);
    if (!calm()) return;
    const item = queue.shift()!;
    current = item;
    setText(text, item.text);
    el.dataset.kind = item.kind;
    if (item.faunaId && item.sceneryId) {
      el.dataset.faunaId = item.faunaId;
      record(item.sceneryId, item.faunaId);
    }
    el.classList.add('is-in');
    ctx.changed();
    later(() => {
      el.classList.remove('is-in');
      later(() => {
        current = null;
        setText(text, '');
        delete el.dataset.faunaId;
        delete el.dataset.kind;
        ctx.changed();
        later(next, ctx.delay(GAP_MS));
      }, ctx.deps.reducedMotion ? 0 : FADE_MS);
    }, ctx.delay(SHOW_MS));
  }

  const offBus = bus.on('fauna:arrived', ({ id, sceneryId }) => {
    if (faunaSeenKey(sceneryId, id) === announcing) return;
    enqueueFauna(sceneryId, id);
    next();
  });

  return {
    el,
    check() {
      next();
    },
    say(t, kind = 'note') {
      queue.unshift({ kind, text: t });
      next();
    },
    hold(ms) {
      holdUntil = Math.max(holdUntil, performance.now() + ctx.delay(ms));
    },
    current: () => current?.text ?? null,
    dispose() {
      offBus();
      for (const t of timers) clearTimeout(t);
    },
  };
}
