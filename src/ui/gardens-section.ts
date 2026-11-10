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
 * (ADR 0285, `scenery/thumbnail.ts`): live, stored, or from the garden's pre-painted overview
 * (ADR 0339). docs/systems/ui.md › Gardens.
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
  /** the pre-paint of the gardens not on view (ADR 0339): its state, why it was skipped, what it is on */
  prepaint(): PrepaintState;
  /** resolves once the pre-paint has gone over every garden, or was skipped (dev and tests) */
  prepaintReady(): Promise<void>;
  dispose(): void;
}

export interface PrepaintState {
  /** `waiting`: the cards have not come near the window yet; `paused`: a session, a hidden tab */
  state: 'waiting' | 'running' | 'paused' | 'done' | 'skipped';
  /** why it was skipped: `save-data`, `battery` */
  reason: string | null;
}

/** below this battery level, unplugged, nothing is pre-painted */
const LOW_BATTERY = 0.2;

/** Why the pre-paint should not run on this device, or null (`navigator.connection.saveData`, a low battery). */
export async function prepaintSkip(nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator): Promise<string | null> {
  const n = nav as (Navigator & { connection?: { saveData?: boolean }; getBattery?: () => Promise<{ level: number; charging: boolean }> }) | undefined;
  if (n?.connection?.saveData) return 'save-data';
  try {
    const b = n?.getBattery ? await n.getBattery() : null;
    if (b && !b.charging && b.level <= LOW_BATTERY) return 'battery';
  } catch {
    // no battery information: go on
  }
  return null;
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
/** between the pre-paint's slices: an idle moment (a busy page still gets a few slices a second) */
const idleSlice = () => new Promise<void>((done) => idle(done, 250));
const hidden = () => typeof document !== 'undefined' && document.hidden;

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
    paint: async (id, thumb) => {
      const paint = ctx.deps.paintOverview;
      if (!paint || (await skipped) !== null) return null;
      pre.state = 'running';
      return (await paint(id, W, H, background, thumb)) as CanvasImageSource | null;
    },
  });

  // the pre-paint (ADR 0339): skipped on save-data or a low battery, paused during a session or in a hidden tab
  const pre: PrepaintState = { state: 'waiting', reason: null };
  const skipped = prepaintSkip().then((why) => {
    if (why) Object.assign(pre, { state: 'skipped', reason: why });
    return why;
  });
  const pausing = () => hidden() || store.get().session !== null;
  async function background(): Promise<void> {
    await idleSlice();
    while (pausing() && !disposed) {
      pre.state = 'paused';
      await idleSlice();
    }
    pre.state = 'running';
  }
  let prepainted: () => void = () => {};
  const firstFill = new Promise<void>((done) => (prepainted = done));
  const fillAll = async () => {
    await thumbs.fill();
    if (pre.state !== 'skipped') pre.state = 'done';
    prepainted();
  };

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
    // a garden left before its live take: from its painting, like one never seen
    if (next.scenery !== prev.scenery && filling) idle(() => void fillAll());
  });

  function start(): void {
    if (started || disposed) return;
    started = true;
    takeSoon();
    // pre-paint the other gardens and fill their thumbnails once the cards near the window (ADR 0339)
    if (typeof IntersectionObserver === 'undefined') {
      filling = true;
      return idle(() => void fillAll());
    }
    near = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near?.disconnect();
        near = null;
        filling = true;
        idle(() => void fillAll());
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
      await fillAll();
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
    prepaint: () => ({ ...pre }),
    async prepaintReady() {
      await Promise.race([firstFill, skipped.then((why) => (why ? undefined : firstFill))]);
      if (pre.state !== 'skipped') await fillAll();
    },
    thumbs: () => choices.map((c) => ({ id: c.id, source: thumbs.source(c.id) })),
    dispose() {
      disposed = true;
      prepainted();
      if (timer !== null) clearTimeout(timer);
      offChange();
      offStore();
      near?.disconnect();
      taken?.();
    },
  };
}
