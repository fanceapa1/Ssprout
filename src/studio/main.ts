import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
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
 */

const modules = import.meta.glob<StudioModule>('/src/**/*.studio.ts', { eager: true });
const sections = collectSections(modules);

const MAX_DPR = 2;
const params = new URLSearchParams(location.search);

interface Card {
  section: StudioSection;
  entry: StudioEntry;
  canvas: HTMLCanvasElement;
  error: HTMLElement;
  frame: number;
  t: number;
  visible: boolean;
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

function sizeCanvas(card: Card) {
  const { entry, canvas, zoom } = card;
  const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
  const pw = Math.max(1, Math.round(entry.w * zoom * dpr));
  const ph = Math.max(1, Math.round(entry.h * zoom * dpr));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  canvas.style.width = `${entry.w * zoom}px`;
  canvas.style.height = `${entry.h * zoom}px`;
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

/** Reset frame counters and re-render everything (static entries render only here). */
function renderAll() {
  for (const card of cards) {
    sizeCanvas(card);
    card.frame = 0;
    card.t = state.t;
    renderCard(card, 0);
  }
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
  const card: Card = { section, entry, canvas, error, frame: 0, t: state.t, visible: true, zoom, failed: false };
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
  cards = [card];
  root.replaceChildren(el('div', { class: 'single' }, [node]));
  renderAll();
}

let observer: IntersectionObserver | null = null;
function observeVisibility() {
  observer?.disconnect();
  if (typeof IntersectionObserver === 'undefined') return;
  observer = new IntersectionObserver((records) => {
    for (const r of records) {
      const card = cards.find((c) => c.canvas === r.target);
      if (card) card.visible = r.isIntersecting;
    }
  });
  for (const c of cards) if (c.entry.animated) observer.observe(c.canvas);
}

let last: number | null = null;
function tick(ts: number) {
  requestAnimationFrame(tick);
  const realDt = last === null ? 0 : Math.min(0.1, (ts - last) / 1000);
  last = ts;
  if (!state.playing) return;
  const dt = realDt * state.speed;
  state.t += dt;
  for (const card of cards) {
    if (!card.entry.animated || !card.visible) continue;
    card.t += dt;
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
};
