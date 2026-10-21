import { activeTips, getTip, type TipContext, type TipId } from '../core/tips';
import type { UIContext } from './context';
import { h, setText } from './dom';
import { pickTips, tipSides } from './format';

/**
 * Tooltips (SPEC §7): tiny handwritten-feel notes on a faint paper slip with a thin ink leader
 * line to their control. Shown only while relevant and not retired (core `activeTips`), at
 * most two at a time, one per screen region. They never take pointer events. Tips for controls
 * inside an open sheet render inside that <dialog> (the top layer); with a sheet open, only its
 * controls carry tips.
 */
export interface Tips {
  readonly el: HTMLElement;
  /** re-evaluate which tips show and where (coalesced to one frame) */
  schedule(): void;
  visible(): TipId[];
  dispose(): void;
}

type Side = 'above' | 'below' | 'left' | 'right';

const GAP = 22;
const MARGIN = 12;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Host {
  el: HTMLElement;
  leaders: SVGSVGElement;
}

const intersects = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function makeHost(): Host {
  const leaders = document.createElementNS(SVG_NS, 'svg');
  leaders.classList.add('tip-leaders');
  leaders.setAttribute('aria-hidden', 'true');
  const el = h('div.tips');
  el.appendChild(leaders);
  return { el, leaders };
}

export function createTips(ctx: UIContext, opts: { tipContext(): TipContext; resolve(anchor: string, id: string): HTMLElement | null }): Tips {
  const { store } = ctx.deps;
  const main = makeHost();
  const dialogHosts = new WeakMap<HTMLDialogElement, Host>();
  const shown = new Map<TipId, { note: HTMLElement; leader: SVGPathElement; host: Host }>();
  let raf: number | null = null;
  let current: TipId[] = [];

  const hostFor = (anchor: HTMLElement): Host => {
    const dialog = anchor.closest('dialog');
    if (!dialog) return main;
    let host = dialogHosts.get(dialog);
    if (!host) {
      host = makeHost();
      host.el.classList.add('tips-in-dialog');
      dialog.appendChild(host.el);
      dialogHosts.set(dialog, host);
    }
    return host;
  };

  const isVisible = (a: HTMLElement | null): a is HTMLElement => {
    if (!a || !a.isConnected || a.closest('[hidden],[inert]')) return false;
    const r = a.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function retire(id: TipId): void {
    const t = shown.get(id);
    if (!t) return;
    shown.delete(id);
    t.note.classList.remove('is-in');
    t.leader.classList.remove('is-in');
    t.note.dataset.leaving = 'true';
    setTimeout(() => {
      t.note.remove();
      t.leader.remove();
    }, ctx.deps.reducedMotion ? 0 : 700);
  }

  function ensure(id: TipId, host: Host): { note: HTMLElement; leader: SVGPathElement } {
    const existing = shown.get(id);
    if (existing && existing.host === host) return existing;
    if (existing) retire(id);
    const note = h('p.tip', { 'data-tip-id': id, role: 'note' });
    const leader = document.createElementNS(SVG_NS, 'path');
    leader.classList.add('tip-leader');
    leader.dataset.tipId = id;
    host.el.appendChild(note);
    host.leaders.appendChild(leader);
    shown.set(id, { note, leader, host });
    requestAnimationFrame(() => {
      note.classList.add('is-in');
      leader.classList.add('is-in');
    });
    return { note, leader };
  }

  function place(id: TipId, anchor: HTMLElement, note: HTMLElement, leader: SVGPathElement, avoid: Box[]): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const a = anchor.getBoundingClientRect();
    const container = anchor.closest<HTMLElement>('[data-ui]')?.getBoundingClientRect() ?? a;
    const w = note.offsetWidth;
    const hgt = note.offsetHeight;
    const cx = a.left + a.width / 2;
    const cy = a.top + a.height / 2;
    const clampX = (x: number) => Math.min(vw - MARGIN - w, Math.max(MARGIN, x));
    const clampY = (y: number) => Math.min(vh - MARGIN - hgt, Math.max(MARGIN, y));
    const candidate = (side: Side): Box & { side: Side } => {
      let x = 0;
      let y = 0;
      if (side === 'above') {
        x = clampX(cx - w * 0.7);
        y = Math.min(a.top, container.top) - GAP - hgt;
      } else if (side === 'below') {
        x = clampX(cx - w * 0.75);
        y = Math.max(a.bottom, container.bottom) + GAP;
      } else if (side === 'left') {
        x = Math.min(a.left, container.left) - GAP * 1.5 - w;
        y = clampY(cy - hgt / 2);
      } else {
        x = Math.max(a.right, container.right) + GAP * 1.5;
        y = clampY(cy - hgt / 2);
      }
      return { side, left: x, top: y, right: x + w, bottom: y + hgt };
    };
    const fits = (b: Box) => b.left >= MARGIN - 0.5 && b.top >= MARGIN - 0.5 && b.right <= vw - MARGIN + 0.5 && b.bottom <= vh - MARGIN + 0.5;
    const options = tipSides(id).map(candidate);
    const pick = options.find((o) => fits(o) && !avoid.some((r) => intersects(o, r))) ?? options.find(fits) ?? options[0]!;
    note.style.transform = `translate(${pick.left.toFixed(0)}px, ${pick.top.toFixed(0)}px)`;
    note.dataset.side = pick.side;
    avoid.push(pick);

    // leader: from the note's facing edge to just short of the anchor, gently curved
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    // the line stops at the control's slip edge, never crossing the slip's text
    if (pick.side === 'above' || pick.side === 'below') {
      x1 = Math.min(Math.max(cx, pick.left + 16), pick.right - 16);
      y1 = pick.side === 'above' ? pick.bottom + 2 : pick.top - 2;
      x2 = cx;
      y2 = pick.side === 'above' ? Math.min(a.top, container.top) - 4 : Math.max(a.bottom, container.bottom) + 4;
    } else {
      x1 = pick.side === 'left' ? pick.right + 2 : pick.left - 2;
      y1 = Math.min(Math.max(cy, pick.top + 10), pick.bottom - 10);
      x2 = pick.side === 'left' ? Math.min(a.left, container.left) - 5 : Math.max(a.right, container.right) + 5;
      y2 = cy;
    }
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
    const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
    leader.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }

  const inlineHost: Host = { el: h('div'), leaders: document.createElementNS(SVG_NS, 'svg') };

  function placeInline(id: TipId, anchor: HTMLElement): void {
    const container = anchor.closest<HTMLElement>('.step') ?? anchor.parentElement!;
    const existing = shown.get(id);
    if (existing && existing.host === inlineHost && existing.note.parentElement === container) {
      setText(existing.note, getTip(id)?.copy ?? '');
      return;
    }
    if (existing) retire(id);
    const note = h('p.tip.tip-inline', { 'data-tip-id': id, role: 'note' }, getTip(id)?.copy ?? '');
    const leader = document.createElementNS(SVG_NS, 'path');
    container.appendChild(note);
    shown.set(id, { note, leader, host: inlineHost });
    requestAnimationFrame(() => note.classList.add('is-in'));
  }

  function layout(): void {
    raf = null;
    const root = ctx.deps.root;
    const openDialog = [...root.querySelectorAll<HTMLDialogElement>('dialog[open]')].find((d) => !d.classList.contains('is-closing')) ?? null;
    const anyClosing = root.querySelector('dialog.is-closing') !== null;
    const active = anyClosing ? [] : activeTips(store.get(), opts.tipContext());
    const anchors = new Map<TipId, HTMLElement>();
    const next = pickTips(active, (anchor, id) => {
      const a = opts.resolve(anchor, id);
      if (!isVisible(a)) return false;
      const inDialog = a.closest('dialog');
      if (openDialog ? inDialog !== openDialog : inDialog !== null) return false;
      anchors.set(id, a);
      return true;
    });
    for (const id of [...shown.keys()]) if (!next.includes(id)) retire(id);
    const avoid: Box[] = openDialog
      ? []
      : [...root.querySelectorAll<HTMLElement>('[data-ui]')].filter((n) => !n.hidden).map((n) => n.getBoundingClientRect());
    const narrow = window.innerWidth < 600;
    for (const id of next) {
      const anchor = anchors.get(id)!;
      if (narrow && anchor.closest('dialog')) {
        // phones: inside a sheet the note sits inline at the end of its step (no room to float)
        placeInline(id, anchor);
        continue;
      }
      const host = hostFor(anchor);
      host.leaders.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
      const { note, leader } = ensure(id, host);
      setText(note, getTip(id)?.copy ?? '');
      place(id, anchor, note, leader, avoid);
    }
    current = next;
  }

  const schedule = () => {
    raf ??= requestAnimationFrame(layout);
  };
  window.addEventListener('resize', schedule);
  void document.fonts?.ready.then(schedule);

  return {
    el: main.el,
    schedule,
    visible: () => [...current],
    dispose() {
      window.removeEventListener('resize', schedule);
      if (raf !== null) cancelAnimationFrame(raf);
    },
  };
}
