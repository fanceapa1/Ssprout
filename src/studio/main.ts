import '../ui/fonts.css';
import './studio.css';
import { createRng } from '../core/rng';
import { collectSections, findEntry, fullId } from './registry';
import type { StudioEntry, StudioModule, StudioSection } from './types';

/**
 * Studio page (studio.html). URL options:
 *   #<section>        show one section
 *   ?entry=<id>       show a single entry, large (`<section>/<entry>` or a unique bare id)
 *   ?seed=<n>         initial seed (default 1)
 *   ?t=<seconds>      start paused at this animation time (stable screenshots)
 *   ?scale=1|2        initial scale; ?bg=paper|white|dark
 *
 * Rendering is lazy (ADR 0006): a card paints only when it nears the screen, a few cards per
 * frame within a time budget, and cards far off screen give their pixels back. Opening the
 * whole studio therefore costs about one screenful, not every sprite at once.
 */

const modules = import.meta.glob<StudioModule>('/src/**/*.studio.ts', { eager: true });
const sections = collectSections(modules);

const MAX_DPR = 2;
/** Main-thread time per frame spent on cards (static first paints and animation). */
const FRAME_BUDGET_MS = 10;
/** Cards this close to the screen paint; animated ones animate only when actually on screen. */
const NEAR_MARGIN = '600px 0px';
/** Cards further than this give their backing store back (re-painted when they return). */
const FAR_MARGIN = '300% 0px';
const params = new URLSearchParams(location.search);

interface Card {
  section: StudioSection;
  entry: StudioEntry;
  canvas: HTMLCanvasElement;
  error: HTMLElement;
  frame: number;
  t: number;
  /** On screen (animated entries animate only then). */
  visible: boolean;
  /** Near the screen: allowed to paint. */
  near: boolean;
  /** Needs a (re)paint at the current seed/t/scale. */
  dirty: boolean;
  zoom: number;
  failed: boolean;
}

const parseNumber = (v: string | null, fallback: number) => {
  const n = Number(v);
  return v !== null && Number.isFinite(n) ? n : fallback;
};

const state = {
  seed: Math.trunc(parseNumber(params.get('seed'), 1)),
  playing: !params.has('t'),
  speed: 1,
  scale: params.get('scale') === '2' ? 2 : 1,
  bg: (['paper', 'white', 'dark'] as const).find((b) => b === params.get('bg')) ?? 'paper',
  t: parseNumber(params.get('t'), 0),
};

const single = params.get('entry');
let cards: Card[] = [];
let renderCount = 0;
/** settle() was called: paint every shown card and keep their pixels (tests, screenshots). */
let pinned = false;
let settleWaiters: Array<() => void> = [];
const errors: string[] = [];

declare global {
  interface Window {
    /** Studio status for tests and screenshots. */
    studio?: {
      ready: boolean;
      entries: string[];
      errors: string[];
      renders(): number;
      pause(): void;
      setT(t: number): void;
      /** Paint every shown card (cooperatively) and keep it painted; resolves when done. */
      settle(): Promise<void>;
      /** Shown cards still waiting for their first paint. */
      pending(): number;
    };
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** Layout size only: the backing store is allocated when the card first paints. */
function styleCanvas(card: Card) {
  const { entry, canvas, zoom } = card;
  canvas.style.width = `${entry.w * zoom}px`;
  canvas.style.height = `${entry.h * zoom}px`;
}

function sizeCanvas(card: Card) {
  const { entry, canvas, zoom } = card;
  const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
  const pw = Math.max(1, Math.round(entry.w * zoom * dpr));
  const ph = Math.max(1, Math.round(entry.h * zoom * dpr));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  styleCanvas(card);
}

/** Give a far-away card's pixels back; it repaints when it comes near again. */
function releaseCard(card: Card) {
  if (pinned || card.canvas.width <= 1) return;
  card.canvas.width = 1;
  card.canvas.height = 1;
  card.dirty = true;
}

function renderCard(card: Card, dt: number) {
  const ctx = card.canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, card.canvas.width, card.canvas.height);
  try {
    ctx.save();
    card.entry.render(card.canvas, {
      t: card.t,
      dt,
      seed: state.seed,
      frame: card.frame,
      pixelRatio: card.canvas.width / card.entry.w,
    });
    ctx.restore();
    card.frame++;
    renderCount++;
    if (card.failed) {
      card.failed = false;
      card.error.textContent = '';
    }
  } catch (err) {
    ctx.restore();
    if (!card.failed) {
      card.failed = true;
      const msg = `${fullId(card.section, card.entry)}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      card.error.textContent = msg;
      console.error('[studio] render failed', msg, err);
    }
  }
}

/** Reset frame counters and mark every card for a repaint; the frame loop paints them lazily. */
function renderAll() {
  for (const card of cards) {
    styleCanvas(card);
    card.frame = 0;
    card.t = state.t;
    card.dirty = true;
  }
}

/** Paint dirty cards that may paint (near the screen, or all when pinned) within the budget. */
function paintDirty(deadline: number): void {
  // on-screen cards first, then the ones just below/above
  for (const pass of [true, false]) {
    for (const card of cards) {
      if (!card.dirty || (pass && !card.visible) || !(pinned || card.near)) continue;
      if (performance.now() > deadline) return;
      sizeCanvas(card);
      card.dirty = false;
      renderCard(card, 0);
    }
  }
}

function pendingCount(): number {
  return cards.filter((c) => c.dirty).length;
}

function resolveSettled() {
  if (settleWaiters.length === 0 || pendingCount() > 0) return;
  const waiters = settleWaiters;
  settleWaiters = [];
  for (const w of waiters) w();
}

function buildCard(section: StudioSection, entry: StudioEntry, zoom: number): { node: HTMLElement; card: Card } {
  const canvas = el('canvas', { 'data-entry': fullId(section, entry) });
  const error = el('p', { class: 'error', role: 'alert' });
  const label = el('figcaption', {}, [
    el('span', { class: 'label' }, [entry.label]),
    el('a', { class: 'id', href: `?entry=${encodeURIComponent(fullId(section, entry))}&seed=${state.seed}` }, [
      fullId(section, entry),
    ]),
    entry.animated ? el('span', { class: 'tag' }, ['animated']) : '',
  ]);
  const node = el('figure', { class: 'card' }, [el('div', { class: 'frame' }, [canvas]), label, error]);
  const card: Card = {
    section,
    entry,
    canvas,
    error,
    frame: 0,
    t: state.t,
    visible: false,
    near: false,
    dirty: true,
    zoom,
    failed: false,
  };
  canvas.width = 1;
  canvas.height = 1;
  styleCanvas(card);
  return { node, card };
}

function controls(): HTMLElement {
  const seed = el('input', { type: 'number', value: String(state.seed), 'aria-label': 'Seed', id: 'seed' });
  seed.addEventListener('change', () => {
    state.seed = Math.trunc(Number(seed.value) || 0);
    renderAll();
  });
  const reseed = el('button', { type: 'button', id: 'reseed' }, ['Reseed']);
  reseed.addEventListener('click', () => {
    state.seed = createRng(state.seed).int(1, 999_999);
    seed.value = String(state.seed);
    renderAll();
  });
  const play = el('button', { type: 'button', id: 'play' }, [state.playing ? 'Pause' : 'Play']);
  play.addEventListener('click', () => {
    state.playing = !state.playing;
    play.textContent = state.playing ? 'Pause' : 'Play';
  });
  const speedOut = el('output', {}, [`${state.speed}×`]);
  const speed = el('input', {
    type: 'range',
    min: '-2',
    max: '2',
    step: '1',
    value: '0',
    'aria-label': 'Animation speed',
    id: 'speed',
  });
  speed.addEventListener('input', () => {
    state.speed = 2 ** Number(speed.value);
    speedOut.textContent = `${state.speed}×`;
  });
  const bg = el('select', { 'aria-label': 'Background', id: 'bg' }, [
    el('option', { value: 'paper' }, ['Paper']),
    el('option', { value: 'white' }, ['White']),
    el('option', { value: 'dark' }, ['Dark']),
  ]);
  bg.value = state.bg;
  bg.addEventListener('change', () => {
    state.bg = bg.value as typeof state.bg;
    document.body.dataset.bg = state.bg;
  });
  const scale = el('select', { 'aria-label': 'Scale', id: 'scale' }, [
    el('option', { value: '1' }, ['1×']),
    el('option', { value: '2' }, ['2×']),
  ]);
  scale.value = String(state.scale);
  scale.addEventListener('change', () => {
    state.scale = Number(scale.value);
    for (const c of cards) c.zoom = state.scale;
    renderAll();
  });
  return el('header', { class: 'controls' }, [
    el('h1', {}, ['Study Sprout · Studio']),
    el('label', {}, ['Seed ', seed]),
    reseed,
    play,
    el('label', {}, ['Speed ', speed, speedOut]),
    el('label', {}, ['Background ', bg]),
    el('label', {}, ['Scale ', scale]),
  ]);
}

function nav(active: string | null): HTMLElement {
  const items = [
    el('li', {}, [el('a', { href: '#', class: active ? '' : 'active' }, ['All sections'])]),
    ...sections.map((s) =>
      el('li', {}, [
        el('a', { href: `#${s.id}`, class: active === s.id ? 'active' : '' }, [
          s.title,
          el('small', {}, [` ${s.entries.length}`]),
        ]),
      ]),
    ),
  ];
  return el('nav', { 'aria-label': 'Sections' }, [el('ul', {}, items)]);
}

function mountGrid(root: HTMLElement) {
  const active = location.hash.slice(1) || null;
  const shown = active ? sections.filter((s) => s.id === active) : sections;
  cards = [];
  pinned = false;
  const main = el('main', {}, []);
  if (shown.length === 0) main.append(el('p', { class: 'empty' }, [`No studio section "${active}".`]));
  for (const section of shown) {
    const grid = el('div', { class: 'grid' });
    for (const entry of section.entries) {
      const { node, card } = buildCard(section, entry, state.scale);
      cards.push(card);
      grid.append(node);
    }
    main.append(el('section', { id: `section-${section.id}` }, [el('h2', {}, [section.title]), grid]));
  }
  root.replaceChildren(controls(), el('div', { class: 'body' }, [nav(active), main]));
  observeVisibility();
  renderAll();
}

function mountSingle(root: HTMLElement, id: string) {
  const found = findEntry(sections, id);
  if (!found) {
    root.replaceChildren(el('p', { class: 'empty' }, [`No studio entry "${id}".`]));
    cards = [];
    return;
  }
  const { entry } = found;
  const zoom = Math.max(0.25, Math.min((window.innerWidth * 0.92) / entry.w, (window.innerHeight * 0.85) / entry.h));
  const { node, card } = buildCard(found.section, entry, zoom);
  card.visible = card.near = true;
  cards = [card];
  root.replaceChildren(el('div', { class: 'single' }, [node]));
  renderAll();
}

let observers: IntersectionObserver[] = [];
function observeVisibility() {
  for (const o of observers) o.disconnect();
  observers = [];
  if (typeof IntersectionObserver === 'undefined') {
    for (const c of cards) c.visible = c.near = true;
    return;
  }
  const byCanvas = new Map(cards.map((c) => [c.canvas as Element, c]));
  const watch = (rootMargin: string, apply: (card: Card, inside: boolean) => void) => {
    const o = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          const card = byCanvas.get(r.target);
          if (card) apply(card, r.isIntersecting);
        }
      },
      { rootMargin },
    );
    for (const c of cards) o.observe(c.canvas);
    observers.push(o);
  };
  watch('0px', (card, inside) => (card.visible = inside));
  watch(NEAR_MARGIN, (card, inside) => (card.near = inside));
  watch(FAR_MARGIN, (card, inside) => {
    if (!inside) releaseCard(card);
  });
}

let last: number | null = null;
/** Round-robin start, so a slow frame doesn't always starve the same animated cards. */
let animCursor = 0;
function tick(ts: number) {
  requestAnimationFrame(tick);
  const deadline = performance.now() + FRAME_BUDGET_MS;
  const realDt = last === null ? 0 : Math.min(0.1, (ts - last) / 1000);
  last = ts;
  paintDirty(deadline);
  resolveSettled();
  if (!state.playing) return;
  const dt = realDt * state.speed;
  state.t += dt;
  const n = cards.length;
  for (let i = 0; i < n; i++) {
    const card = cards[(animCursor + i) % n]!;
    if (!card.entry.animated) continue;
    card.t += dt;
    if (!card.visible || card.dirty) continue;
    if (performance.now() > deadline) {
      animCursor = (animCursor + i) % n;
      return;
    }
    renderCard(card, dt);
  }
}

function mount() {
  const root = document.querySelector<HTMLElement>('#studio');
  if (!root) throw new Error('missing #studio root');
  document.body.dataset.bg = state.bg;
  if (single) mountSingle(root, single);
  else mountGrid(root);
}

mount();
window.addEventListener('hashchange', () => {
  if (!single) mountGrid(document.querySelector<HTMLElement>('#studio')!);
});
requestAnimationFrame(tick);

window.studio = {
  ready: true,
  get entries() {
    return cards.map((c) => fullId(c.section, c.entry));
  },
  errors,
  renders: () => renderCount,
  pause() {
    state.playing = false;
    const btn = document.querySelector('#play');
    if (btn) btn.textContent = 'Play';
  },
  setT(t: number) {
    state.t = t;
    renderAll();
  },
  settle() {
    pinned = true;
    return new Promise<void>((resolve) => {
      settleWaiters.push(resolve);
      resolveSettled();
    });
  },
  pending: pendingCount,
};
