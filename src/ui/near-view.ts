/**
 * Work below the fold, done when it is due (ADR 0225). The dock's sheets, its guiding path and the
 * "Your plant" painting wait for the garden's first paint, then run when their element nears the
 * window (an IntersectionObserver with a generous margin), or earlier on an idle moment so they are
 * ready before the gardener scrolls to them. A task is never run inside `request`, so a click that
 * changes a section only marks it to be drawn.
 *
 *   const near = createNearView({ ready: renderer.whenReady() });
 *   near.request(section, () => drawSheet());            // near the window, or idle
 *   near.request(section, () => repaint(), { idle: false }); // only once it nears the window
 *   near.flush();                                         // everything now (tests' dockReady)
 */
export interface NearViewOptions {
  /** resolves once the garden has painted; null opens at once (studio, unit tests) */
  ready: Promise<unknown> | null;
  /** how far outside the window counts as near (an IntersectionObserver root margin) */
  rootMargin?: string;
  /** the longest an idle-eligible task waits for an idle moment, in ms */
  idleTimeout?: number;
}

export interface NearViewRequest {
  /**
   * May run on an idle moment before the element nears the window (default true). Repeated
   * requests for one element keep `true` if any asked for it.
   */
  idle?: boolean;
}

export interface NearView {
  /** run `task` for `el` when it is due; requests for one element coalesce (the latest task wins) */
  request(el: Element, task: () => void, opts?: NearViewRequest): void;
  /** the garden has painted and `el` is near the window (known once the observer has reported) */
  near(el: Element): boolean;
  /** resolves once the garden has painted and a frame has shown it */
  opened(): Promise<void>;
  /** run every waiting task now, garden painted or not */
  flush(): void;
  /** how many tasks are waiting */
  pending(): number;
  dispose(): void;
}

interface Pending {
  task: () => void;
  idle: boolean;
}

/** Near: within one window height above or below it. */
export const NEAR_MARGIN = '100% 0px';

export function createNearView(opts: NearViewOptions): NearView {
  const tasks = new Map<Element, Pending>();
  const nearNow = new Map<Element, boolean>();
  let open = opts.ready === null;
  let disposed = false;
  let frame: number | null = null;
  let idle: number | null = null;
  let resolveOpened!: () => void;
  const openedP = new Promise<void>((r) => (resolveOpened = r));
  if (open) resolveOpened();

  const hasIO = typeof IntersectionObserver === 'function';
  const io = hasIO
    ? new IntersectionObserver(
        (entries) => {
          const due: Element[] = [];
          for (const e of entries) {
            nearNow.set(e.target, e.isIntersecting);
            if (e.isIntersecting && tasks.has(e.target)) due.push(e.target);
          }
          if (open) for (const el of due) run(el);
        },
        { rootMargin: opts.rootMargin ?? NEAR_MARGIN },
      )
    : null;

  const isNear = (el: Element) => (io ? nearNow.get(el) === true : true);
  /** observing a connected element can cost a style and layout pass: none before the garden is painted */
  const unobserved = new Set<Element>();
  const observe = (el: Element) => {
    if (!io || nearNow.has(el)) return;
    if (!open) {
      unobserved.add(el);
      return;
    }
    nearNow.set(el, false);
    io.observe(el);
  };

  function run(el: Element): void {
    const p = tasks.get(el);
    if (!p || disposed) return;
    tasks.delete(el);
    p.task();
  }

  function scheduleFrame(): void {
    if (frame !== null || disposed) return;
    const go = () => {
      frame = null;
      if (!open) return;
      for (const el of [...tasks.keys()]) if (isNear(el)) run(el);
    };
    frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(go) : (setTimeout(go, 16) as unknown as number);
  }

  function scheduleIdle(): void {
    if (idle !== null || disposed || !open) return;
    if (![...tasks.values()].some((p) => p.idle)) return;
    const timeout = opts.idleTimeout ?? 2000;
    const drain = (deadline?: IdleDeadline) => {
      idle = null;
      if (!open || disposed) return;
      // at least one task per idle period; more while the period has room
      let first = true;
      for (const [el, p] of [...tasks]) {
        if (!p.idle) continue;
        if (!first && deadline && !deadline.didTimeout && deadline.timeRemaining() < 6) break;
        first = false;
        run(el);
      }
      scheduleIdle();
    };
    idle =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(drain, { timeout })
        : (setTimeout(() => drain(), 200) as unknown as number);
  }

  function openNow(): void {
    if (open || disposed) return;
    open = true;
    resolveOpened();
    for (const el of unobserved) observe(el);
    unobserved.clear();
    scheduleFrame();
    scheduleIdle();
  }

  if (!open) {
    // the frame that shows the painting goes out first; the dock's work runs after it
    const afterFrame = () => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        setTimeout(openNow, 0);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
      // a hidden tab gets no frames: do not hold the dock back for one
      setTimeout(go, 500);
    };
    opts.ready!.then(afterFrame, afterFrame);
  }

  return {
    request(el, task, o) {
      if (disposed) return;
      const prev = tasks.get(el);
      tasks.set(el, { task, idle: (o?.idle ?? true) || (prev?.idle ?? false) });
      observe(el);
      if (!open) return;
      if (isNear(el)) scheduleFrame();
      else scheduleIdle();
    },
    near: (el) => open && isNear(el),
    opened: () => openedP,
    flush() {
      for (const el of [...tasks.keys()]) run(el);
    },
    pending: () => tasks.size,
    dispose() {
      disposed = true;
      tasks.clear();
      unobserved.clear();
      io?.disconnect();
      if (frame !== null) (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout)(frame);
      if (idle !== null) (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout)(idle);
    },
  };
}
