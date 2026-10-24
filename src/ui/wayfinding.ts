import type { Viewport } from '../render/viewport';
import { PATH } from '../scene/geometry';
import type { Dock } from './dock';
import type { NearView } from './near-view';
import { brushOutline, centrePath, layoutPath, stonePath, type PathLayout } from './wayfinding-path';

/**
 * The guiding path (ADR 0202): a hand-inked line that leaves the garden where its stepping stones
 * run out of the painting and walks down the dock's lane, a small stepping stone beside each
 * section heading, in the dock's order. It is drawn behind the content, low in contrast, and laid
 * out again whenever the page moves under it: a resize, a section appearing or going (the dock's
 * `onChange`), a section's content growing or shrinking (ResizeObserver), the fonts arriving.
 *
 * It hooks into the dock registry only: its stops are `dock.sections()` that are visible, at their
 * `heading`. A section added later gets its stop with no change here.
 *
 * The same layout serves every width (owner: "only if you can make it responsive without too much
 * of a hassle"): on wide screens the lane is broad and the line meanders inside it; on phones it is
 * a narrow gutter and the line runs straight. The stop of the section being read is a little
 * darker. A gentle draw-in plays once, the first time the dock comes into view; never with
 * reduced motion.
 */
export interface WayfindingDeps {
  dock: Dock;
  /** the garden stage (its bottom edge is where the line comes from) */
  stage: HTMLElement;
  /** the renderer's viewport (stage CSS pixels per world unit), to find the stepping stones */
  viewport(): Viewport;
  reducedMotion?: boolean;
  /**
   * Lay out only after the garden's first paint, and then as the dock nears the window or on an
   * idle moment (ADR 0225). Without it, the next frame.
   */
  near?: NearView | null;
}

export interface WayfindingStop {
  id: string;
  /** client coordinates of the stop's centre */
  x: number;
  y: number;
  /** the section being read */
  here: boolean;
}

export interface WayfindingState {
  /** the stops, in page order */
  stops: WayfindingStop[];
  /** the centre line in client coordinates (sampled every 4 px) */
  points: Array<{ x: number; y: number }>;
  /** 'drawing' while the first draw-in plays, else 'drawn' ('instant' with reduced motion) */
  drawn: 'waiting' | 'drawing' | 'drawn' | 'instant';
  /** layouts done (tests wait on it after a change) */
  layouts: number;
  /** the lane's width class: 'wide' (meanders) or 'gutter' (straight, phones) */
  mode: 'wide' | 'gutter';
}

export interface Wayfinding {
  readonly el: SVGSVGElement;
  /** lay out now (normally scheduled on its own) */
  layout(): void;
  state(): WayfindingState;
  dispose(): void;
}

const SVG = 'http://www.w3.org/2000/svg';
const DRAW_MS = 2600;

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/** Where the stepping stones end on the stage: the nearest stone still clear of the dissolving edge. */
function stonesExit(vp: Viewport, stageH: number): { x: number; y: number } | null {
  for (const s of PATH) {
    const p = vp.worldToScreen({ x: s.x, y: s.y + s.ry });
    if (p.y <= stageH - 44) return p;
  }
  return null;
}

const num = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

export function createWayfinding(deps: WayfindingDeps): Wayfinding {
  const { dock } = deps;
  const el = svg('svg', { class: 'wayfinding', 'aria-hidden': 'true', focusable: 'false' });
  const defs = svg('defs');
  const mask = svg('mask', { id: 'wayfinding-reveal', maskUnits: 'userSpaceOnUse' });
  const reveal = svg('path', { class: 'way-reveal', fill: 'none', stroke: '#fff', 'stroke-width': '34', 'stroke-linecap': 'round', pathLength: '1' });
  mask.append(reveal);
  defs.append(mask);
  const line = svg('g', { class: 'way-line', mask: 'url(#wayfinding-reveal)' });
  const ink = svg('path', { class: 'way-ink' });
  line.append(ink);
  const stonesG = svg('g', { class: 'way-stops' });
  el.append(defs, line, stonesG);
  dock.el.prepend(el);

  let layout: PathLayout | null = null;
  let stopEls: SVGGElement[] = [];
  let here: string | null = null;
  let drawn: WayfindingState['drawn'] = deps.reducedMotion ? 'instant' : 'waiting';
  let layouts = 0;
  let mode: WayfindingState['mode'] = 'wide';
  let raf: number | null = null;
  let drawTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function schedule(): void {
    if (disposed) return;
    if (deps.near) return deps.near.request(dock.el, doLayout);
    if (raf !== null) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      doLayout();
    });
  }

  function doLayout(): void {
    if (disposed) return;
    const visible = dock.sections().filter((s) => s.visible);
    const dockRect = dock.el.getBoundingClientRect();
    if (visible.length === 0 || dockRect.width === 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const cs = getComputedStyle(dock.el);
    const stopGap = num(cs.getPropertyValue('--stop-gap'), 30);
    const rise = num(cs.getPropertyValue('--path-rise'), 0);
    const sway = num(cs.getPropertyValue('--path-sway'), 0);
    const stoneW = num(cs.getPropertyValue('--stop-size'), 22);
    mode = sway > 0 ? 'wide' : 'gutter';
    const heads = visible.map((s) => ({ id: s.id, rect: dock.get(s.id)!.heading.getBoundingClientRect() }));
    const contentLeft = Math.min(...visible.map((s) => dock.get(s.id)!.el.getBoundingClientRect().left)) - dockRect.left;
    // the layer reaches `rise` px up into the garden's dissolving edge
    const W = Math.ceil(dockRect.width);
    const H = Math.ceil(dockRect.height + rise);
    el.setAttribute('viewBox', `0 0 ${W} ${H}`);
    el.setAttribute('width', String(W));
    el.setAttribute('height', String(H));
    el.style.top = `${-rise}px`;
    const toLayer = (clientY: number) => clientY - dockRect.top + rise;
    // where the stones leave the painting, in the layer
    const stageRect = deps.stage.getBoundingClientRect();
    let sx = W / 2;
    let sy = Math.max(6, rise - 8);
    try {
      const p = stonesExit(deps.viewport(), stageRect.height);
      if (p) {
        sx = stageRect.left + p.x - dockRect.left;
        sy = toLayer(stageRect.top + p.y);
      }
    } catch {
      /* no viewport yet: from the middle of the stage's bottom edge */
    }
    sy = Math.max(6, Math.min(sy, rise - 6));
    sx = Math.max(contentLeft, Math.min(W - 40, sx));
    const lane = contentLeft - stopGap;
    // the crossing to the lane is done above the first section's sheet, not only its heading (ADR 0208)
    const firstSheet = dock.get(visible[0]!.id)!.el.getBoundingClientRect();
    const first = { top: Math.min(heads[0]!.rect.top, firstSheet.top) };
    layout = layoutPath({
      start: { x: sx, y: sy },
      lane,
      contentLeft,
      clearTop: toLayer(first.top),
      stops: heads.map((x) => ({ id: x.id, y: toLayer(x.rect.top + x.rect.height / 2) })),
      tail: num(cs.getPropertyValue('--path-tail'), 64),
      sway,
      seed: 'dock',
    });
    ink.setAttribute(
      'd',
      brushOutline(layout, {
        width: num(cs.getPropertyValue('--path-width'), 2.4),
        stopRadius: stoneW * 0.62,
        fadeIn: Math.min(140, rise + 60),
        liftOff: 60,
        seed: 'dock',
      }),
    );
    reveal.setAttribute('d', centrePath(layout));
    // stones: reuse their elements; each keeps its own seeded shape
    const total = Math.max(1, layout.length);
    stopEls = layout.stops.map((st, i) => {
      let g = stopEls[i];
      if (!g) {
        g = svg('g', { class: 'way-stop' });
        g.append(svg('path', { class: 'way-stone' }), svg('path', { class: 'way-stone-rim' }));
        stonesG.append(g);
      }
      if (g.dataset.stop !== st.id || g.dataset.size !== String(stoneW)) {
        const d = stonePath(st.id, stoneW / 2, stoneW * 0.3);
        for (const p of g.querySelectorAll('path')) p.setAttribute('d', d);
        g.dataset.stop = st.id;
        g.dataset.size = String(stoneW);
      }
      g.setAttribute('transform', `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)})`);
      g.style.setProperty('--at', (st.s / total).toFixed(3));
      return g;
    });
    for (const extra of [...stonesG.children].slice(layout.stops.length)) extra.remove();
    layouts++;
    el.dataset.layouts = String(layouts);
    el.dataset.mode = mode;
    markHere();
  }

  // ── the section being read: its stop is a little darker ─────────────────────────────────
  function markHere(): void {
    if (!layout) return;
    const r = el.getBoundingClientRect();
    // the reading line, a quarter of the way down the window: the last heading above it is being read
    const line = window.innerHeight * 0.25;
    let id: string | null = null;
    for (const st of layout.stops) if (r.top + st.y <= line) id = st.id;
    // nothing passed yet but the first heading is on screen: it is the one being read
    if (id === null && layout.stops[0] && r.top + layout.stops[0].y < window.innerHeight) id = layout.stops[0].id;
    // at the foot of the page the last sections never reach the line: the lowest heading in view
    const doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
      for (const st of layout.stops) if (r.top + st.y < window.innerHeight * 0.85) id = st.id;
    }
    if (id === here) return;
    here = id;
    for (const g of stopEls) g.classList.toggle('is-here', g.dataset.stop === id);
  }
  let scrollRaf: number | null = null;
  const onScroll = () => {
    if (scrollRaf !== null) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      markHere();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── the draw-in, once, when the dock first comes into view ─────────────────────────────
  let io: IntersectionObserver | null = null;
  if (drawn === 'waiting' && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io?.disconnect();
        io = null;
        drawn = 'drawing';
        el.classList.add('is-drawing');
        drawTimer = setTimeout(() => {
          drawn = 'drawn';
          el.classList.remove('is-drawing');
        }, DRAW_MS + 1200);
      },
      { threshold: 0 },
    );
    io.observe(dock.el);
  } else if (drawn === 'waiting') drawn = 'drawn';

  // ── what moves the page under the path ─────────────────────────────────────────────────
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
  const observeSections = () => {
    if (!ro) return;
    ro.disconnect();
    ro.observe(dock.el);
    ro.observe(deps.stage);
    for (const s of dock.sections()) {
      const sec = dock.get(s.id);
      if (sec) {
        ro.observe(sec.el);
        ro.observe(sec.heading);
      }
    }
  };
  observeSections();
  const offDock = dock.onChange(() => {
    observeSections();
    schedule();
  });
  window.addEventListener('resize', schedule);
  // reading `document.fonts.ready` costs a style pass: with `near`, not before the garden is painted
  const afterFonts = () => void document.fonts?.ready.then(() => schedule());
  if (deps.near) void deps.near.opened().then(afterFonts);
  else afterFonts();
  schedule();

  return {
    el,
    layout: doLayout,
    state() {
      const r = el.getBoundingClientRect();
      return {
        stops: (layout?.stops ?? []).map((s) => ({ id: s.id, x: r.left + s.x, y: r.top + s.y, here: s.id === here })),
        points: (layout?.points ?? []).map((p) => ({ x: r.left + p.x, y: r.top + p.y })),
        drawn,
        layouts,
        mode,
      };
    },
    dispose() {
      disposed = true;
      if (raf !== null) cancelAnimationFrame(raf);
      if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
      if (drawTimer !== null) clearTimeout(drawTimer);
      io?.disconnect();
      ro?.disconnect();
      offDock();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
      el.remove();
    },
  };
}
