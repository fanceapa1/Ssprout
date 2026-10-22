import {
  approach,
  clampScroll,
  glideAt,
  glideDuration,
  keyScroll,
  wheelPixels,
} from './scroll-math';

/**
 * The page's own smooth scrolling (ADR 0131). The document scrolls natively underneath; this only
 * decides *how* wheel, keyboard and in-page jumps move it:
 * - wheel (anywhere on the page, the garden canvas included) and arrow keys: an eased approach to
 *   a target that each further input pushes on;
 * - PgUp/PgDn/Space/Home/End and `scrollTo`/`scrollToElement` (in-page jumps, the timer pill):
 *   a timed glide that breathes in and out;
 * - touch: untouched (native momentum); scrollbar drags and any other native scroll (find in page,
 *   focus moving, test tools) are adopted at once — the next input starts from wherever the page is;
 * - `prefers-reduced-motion: reduce`: every input lands at once, no smoothing.
 * ctrl/⌘ + wheel (trackpad pinch) is never turned into page scrolling (the stage's zoom hook).
 * Inner scrollers (an open sheet, a long list) keep their own native wheel scrolling.
 */
export interface ScrollState {
  /** current scroll position (px) */
  y: number;
  /** furthest scroll position (px) */
  max: number;
  /** where an animation is heading (= y when idle) */
  target: number;
  animating: boolean;
  /** false under reduced motion */
  smooth: boolean;
}

export interface ScrollOptions {
  /** land at once (no glide) */
  instant?: boolean;
}

export interface SmoothScroll {
  state(): ScrollState;
  /** glide to `y`; resolves when it arrives (or is interrupted by other scrolling) */
  scrollTo(y: number, opts?: ScrollOptions): Promise<void>;
  /** glide so `el` sits `offset` px below the top of the viewport */
  scrollToElement(el: Element, opts?: ScrollOptions & { offset?: number }): Promise<void>;
  /** called after every scroll position change, native or ours (for the scrollbar) */
  onChange(fn: (s: ScrollState) => void): () => void;
  dispose(): void;
}

export interface SmoothScrollDeps {
  win?: Window;
  /** start in reduced motion (also follows the media query when `win.matchMedia` exists) */
  reducedMotion?: boolean;
}

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
/** Controls that use the arrow keys themselves. */
const ARROW_OWNERS = '[role="radio"], [role="radiogroup"], [role="slider"], [role="tab"], [role="tablist"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"], [role="spinbutton"], [role="combobox"], [role="grid"], [role="tree"]';
/** Space activates these instead of scrolling. */
const ACTIVATES = 'button, a[href], summary, label, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"])';

export function createSmoothScroll(deps: SmoothScrollDeps = {}): SmoothScroll {
  const win = deps.win ?? window;
  const doc = win.document;
  const listeners = new Set<(s: ScrollState) => void>();
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let smooth = !(deps.reducedMotion ?? media?.matches ?? false);

  let mode: 'idle' | 'follow' | 'glide' = 'idle';
  let target = win.scrollY;
  let pos = win.scrollY;
  let lastApplied = win.scrollY;
  let glide = { from: 0, to: 0, start: 0, duration: 0 };
  let raf: number | null = null;
  let lastTs: number | null = null;
  let waiters: Array<() => void> = [];

  const el = () => doc.scrollingElement ?? doc.documentElement;
  const maxScroll = () => Math.max(0, el().scrollHeight - win.innerHeight);
  const state = (): ScrollState => ({ y: win.scrollY, max: maxScroll(), target: mode === 'idle' ? win.scrollY : target, animating: mode !== 'idle', smooth });
  const emit = () => {
    const s = state();
    for (const fn of [...listeners]) fn(s);
  };

  const settle = () => {
    mode = 'idle';
    if (raf !== null) win.cancelAnimationFrame(raf);
    raf = null;
    lastTs = null;
    const w = waiters;
    waiters = [];
    for (const fn of w) fn();
  };

  const apply = (y: number) => {
    pos = y;
    lastApplied = y;
    win.scrollTo({ top: y, left: win.scrollX, behavior: 'instant' as ScrollBehavior });
  };

  const frame = (ts: number) => {
    raf = null;
    const dt = lastTs === null ? 16 : Math.min(64, ts - lastTs);
    lastTs = ts;
    const max = maxScroll();
    target = clampScroll(target, max);
    let next: number;
    if (mode === 'glide') {
      next = glideAt(glide.from, clampScroll(glide.to, max), ts - glide.start, glide.duration);
      if (ts - glide.start >= glide.duration) next = clampScroll(glide.to, max);
    } else {
      next = approach(pos, target, dt);
    }
    apply(next);
    if (next === target) {
      settle();
      emit();
      return;
    }
    raf = win.requestAnimationFrame(frame);
  };

  const run = () => {
    raf ??= win.requestAnimationFrame(frame);
  };

  /** Move toward `y`: eased approach (`follow`), timed `glide`, or at once without smoothing. */
  function go(y: number, how: 'follow' | 'glide', instant = false): Promise<void> {
    const to = clampScroll(y, maxScroll());
    const done = new Promise<void>((resolve) => waiters.push(resolve));
    if (!smooth || instant) {
      target = to;
      apply(to);
      settle();
      emit();
      return done;
    }
    if (mode === 'idle') pos = win.scrollY;
    target = to;
    if (how === 'glide') {
      glide = { from: pos, to, start: win.performance.now(), duration: glideDuration(to - pos) };
      mode = 'glide';
    } else if (mode !== 'glide' || how === 'follow') {
      mode = 'follow';
    }
    if (Math.abs(to - pos) <= 0.5) {
      apply(to);
      settle();
      emit();
      return done;
    }
    run();
    return done;
  }

  // ── inputs ──────────────────────────────────────────────────────────────────────────────
  const modalOpen = () => doc.querySelector('dialog[open]') !== null;

  /** An element between the target and the page that will scroll natively in this direction. */
  function innerScroller(from: EventTarget | null, dy: number): boolean {
    let n = from instanceof Element ? from : null;
    const root = el();
    while (n && n !== root && n !== doc.body) {
      if (n.scrollHeight > n.clientHeight + 1) {
        const oy = win.getComputedStyle(n).overflowY;
        if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
          if (dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true;
          if (dy < 0 && n.scrollTop > 0) return true;
        }
      }
      n = n.parentElement;
    }
    return false;
  }

  const onWheel = (e: WheelEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey) return; // zoom gestures are not page scrolling
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways: native
    if (modalOpen() || innerScroller(e.target, e.deltaY)) return;
    const max = maxScroll();
    if (max <= 0) return;
    const dy = wheelPixels(e, win.innerHeight);
    if (dy === 0) return;
    e.preventDefault();
    const from = mode === 'idle' ? win.scrollY : target;
    void go(from + dy, 'follow');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || modalOpen()) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest(EDITABLE)) return;
    if (e.key.startsWith('Arrow') && t?.closest(ARROW_OWNERS)) return;
    if ((e.key === ' ' || e.key === 'Spacebar') && t && t !== doc.body && t.closest(ACTIVATES)) return;
    const from = mode === 'idle' ? win.scrollY : target;
    const next = keyScroll(e.key, e.shiftKey, from, maxScroll(), win.innerHeight);
    if (!next) return;
    e.preventDefault();
    void go(next.target, next.kind === 'step' ? 'follow' : 'glide');
  };

  /** In-page anchors (`<a href="#id">`) glide instead of jumping. */
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    const id = a?.getAttribute('href')?.slice(1);
    if (!a || !id) return;
    const dest = doc.getElementById(decodeURIComponent(id));
    if (!dest) return;
    e.preventDefault();
    win.history?.replaceState?.(null, '', `#${id}`);
    void scrollToElement(dest).then(() => {
      if (dest.matches('[tabindex], a[href], button, input, select, textarea')) dest.focus({ preventScroll: true });
    });
  };

  /** Any scroll we did not make (scrollbar drag, focus, find in page, touch) is adopted. */
  const onScroll = () => {
    const y = win.scrollY;
    if (Math.abs(y - lastApplied) > 2) {
      if (mode !== 'idle') settle();
      pos = target = lastApplied = y;
    }
    emit();
  };

  const onMotion = () => {
    smooth = !media?.matches;
    if (!smooth && mode !== 'idle') void go(target, 'follow', true);
  };

  function scrollToElement(dest: Element, opts: ScrollOptions & { offset?: number } = {}): Promise<void> {
    const top = dest.getBoundingClientRect().top + win.scrollY - (opts.offset ?? 16);
    return go(top, 'glide', opts.instant);
  }

  win.addEventListener('wheel', onWheel, { passive: false });
  win.addEventListener('keydown', onKey);
  win.addEventListener('scroll', onScroll, { passive: true });
  doc.addEventListener('click', onClick);
  media?.addEventListener?.('change', onMotion);

  return {
    state,
    scrollTo: (y, opts = {}) => go(y, 'glide', opts.instant),
    scrollToElement,
    onChange(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    dispose() {
      settle();
      listeners.clear();
      win.removeEventListener('wheel', onWheel);
      win.removeEventListener('keydown', onKey);
      win.removeEventListener('scroll', onScroll);
      doc.removeEventListener('click', onClick);
      media?.removeEventListener?.('change', onMotion);
    },
  };
}
