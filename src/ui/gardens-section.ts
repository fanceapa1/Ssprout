import type { SceneryId } from '../scenery/ids';
import { cacheStore, createThumbnails, type ThumbSource } from '../scenery/thumbnail';
import { paintCache } from '../paint/persist';
import type { AnyCanvas } from '../paint';
import type { UIContext } from './context';
import { h, setText } from './dom';
import type { GardenChoice } from './types';

/**
 * The dock's Gardens section (ADR 0244): a card per garden to choose from, the one on view
 * marked. Choosing dispatches `scenery/view`. Thumbnails are small overviews of each garden
 * (ADR 0285, `scenery/thumbnail.ts`): live, stored, or painted small. docs/systems/ui.md › Gardens.
 */
export interface GardensSection {
  readonly el: HTMLElement;
  /** mark the garden on view (called on every UI refresh) */
  refresh(): void;
  /** take the garden on view's thumbnail soon (once it has settled), then fill the others */
  start(): void;
  /** where each garden's thumbnail comes from (dev and tests) */
  thumbs(): Array<{ id: SceneryId; source: ThumbSource }>;
  /** resolves once the garden on view has its live thumbnail and the others theirs (dev and tests) */
  settle(): Promise<void>;
  dispose(): void;
}

/** CSS px of the card's still (8:5, the world's shape); the canvas holds it at up to 2× */
const THUMB_W = 224;
const THUMB_H = 140;
/** after a garden's first paint, or a plant change: let the painting and the sprites settle */
const SETTLE_MS = 1500;
/** the garden on view cannot be drawn yet (switching): try again after this long */
const RETRY_MS = 400;
/** a garden that never gets ready (a system failed): stop trying after about thirty seconds */
const MAX_TRIES = 75;

const idle = (fn: () => void, timeout = 2000) => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout });
  else setTimeout(fn, 0);
};
/** between the small paint's slices: an idle moment, but never a long wait on a busy page */
const idleSlice = () => new Promise<void>((done) => idle(done, 60));

export function createGardensSection(ctx: UIContext, choices: readonly GardenChoice[]): GardensSection {
  const { store, controller } = ctx.deps;
  const dpr = Math.min(2, Math.max(1, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
  const W = Math.round(THUMB_W * dpr);
  const H = Math.round(THUMB_H * dpr);
  const cards = new Map<SceneryId, { button: HTMLButtonElement; thumb: HTMLCanvasElement; mark: HTMLElement }>();
  const list = h('ul.gardens', { role: 'list' });

  const fresh = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const cache = cacheStore(paintCache(), W, H);
  const thumbs = createThumbnails<CanvasImageSource>({
    ids: choices.map((c) => c.id),
    viewed: () => store.get().scenery,
    live: () => {
      const draw = ctx.deps.drawOverview;
      if (!draw) return null;
      const c = fresh();
      return draw(c) ? c : null;
    },
    stored: (id) => cache.stored(id),
    store: (id, img) => {
      // a stored one is already in the cache
      if (typeof ImageBitmap === 'undefined' || !(img instanceof ImageBitmap)) cache.store(id, img as AnyCanvas);
    },
    paint: async (id) => (ctx.deps.paintOverview ? ((await ctx.deps.paintOverview(id, W, H, idleSlice)) as CanvasImageSource | null) : null),
  });

  for (const c of choices) {
    const thumb = h('canvas.garden-thumb', { width: W, height: H, 'aria-hidden': 'true', 'data-still': 'waiting' });
    const mark = h('span.garden-mark');
    const button = h(
      'button.garden-card',
      {
        type: 'button',
        'data-scenery': c.id,
        'aria-pressed': 'false',
        'aria-describedby': `garden-blurb-${c.id}`,
        onclick: () => choose(c.id),
      },
      thumb,
      h('span.garden-name', {}, c.name),
      h('span.garden-blurb', { id: `garden-blurb-${c.id}` }, c.blurb),
      mark,
    );
    cards.set(c.id, { button, thumb, mark });
    list.append(h('li', {}, button));
  }

  const offChange = thumbs.onChange((id) => {
    const card = cards.get(id);
    const img = thumbs.image(id);
    const g = card?.thumb.getContext('2d');
    if (!card || !img || !g) return;
    g.clearRect(0, 0, W, H);
    g.drawImage(img, 0, 0, W, H);
    card.thumb.dataset.still = thumbs.source(id);
  });

  // the live take waits for the garden to settle; `pending` resolves when it is taken
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<void> = Promise.resolve();
  let taken: (() => void) | null = null;
  let started = false;
  let near: IntersectionObserver | null = null;
  /** the other gardens' thumbnails are being filled in (the cards came near the window) */
  let filling = false;
  let disposed = false;
  let tries = 0;
  const takeSoon = (ms = SETTLE_MS) => {
    if (disposed) return;
    if (ms !== RETRY_MS) tries = 0;
    if (!taken) pending = new Promise<void>((done) => (taken = done));
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      idle(() => {
        if (disposed) return;
        if (thumbs.takeLive()) {
          taken?.();
          taken = null;
        } else if (ctx.deps.drawOverview && ++tries < MAX_TRIES) takeSoon(RETRY_MS);
        else {
          taken?.();
          taken = null;
        }
      });
    }, ms);
  };

  function choose(id: SceneryId): void {
    if (store.get().scenery === id) return;
    // the garden left keeps how it looks now (never mid-switch: drawOverview refuses then)
    thumbs.takeLive();
    controller.showScenery(id);
  }

  // a new garden on view, or its plants changed: take it again once it has settled
  let seen = store.get();
  const offStore = store.subscribe((next) => {
    const prev = seen;
    seen = next;
    if (!started) return;
    if (next.scenery !== prev.scenery || next.plants !== prev.plants) takeSoon();
    // a garden left before its live take: painted small, like one never seen
    if (next.scenery !== prev.scenery && filling) idle(() => void thumbs.fill());
  });

  function start(): void {
    if (started || disposed) return;
    started = true;
    takeSoon();
    // the stored or small painted thumbnails of the other gardens: once the cards near the window
    if (typeof IntersectionObserver === 'undefined') {
      filling = true;
      return idle(() => void thumbs.fill());
    }
    near = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near?.disconnect();
        near = null;
        filling = true;
        idle(() => void thumbs.fill());
      },
      { rootMargin: '400px 0px' },
    );
    near.observe(list);
  }

  async function settle(): Promise<void> {
    start();
    filling = true;
    for (let i = 0; i < 3; i++) {
      await pending;
      await thumbs.fill();
      if (!taken) return;
    }
  }

  function refresh(): void {
    const viewed = store.get().scenery;
    for (const [id, c] of cards) {
      const on = id === viewed;
      c.button.setAttribute('aria-pressed', String(on));
      c.button.dataset.viewed = String(on);
      setText(c.mark, on ? 'On view' : 'Go here');
    }
  }

  refresh();
  return {
    el: list,
    refresh,
    start,
    settle,
    thumbs: () => choices.map((c) => ({ id: c.id, source: thumbs.source(c.id) })),
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      offChange();
      offStore();
      near?.disconnect();
      taken?.();
    },
  };
}
