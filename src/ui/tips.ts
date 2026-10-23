import { activeTips, getTip, type TipContext, type TipId } from '../core/tips';
import type { UIContext } from './context';
import { fragment, h, setText } from './dom';
import { pickTips, tipSides } from './format';
import { ICONS } from './icons';
import { placeTip, type Box, type TipSpot } from './tip-place';

/**
 * Tooltips (SPEC §7): tiny handwritten-feel notes on a faint paper slip with a thin ink leader
 * line to their control. Shown only while relevant and not retired (core `activeTips`), one at
 * a time — the most relevant (`TIP_PRIORITY`) whose control is wholly on screen and has room for
 * its note; the others wait their turn. The slip never takes pointer events; only its small inked
 * × does (ADR 0211): it, or Esc inside the note, dismisses the tip for good (retired as
 * `dismissed`), focus goes back to the tip's control, and the next tip waits for the dismissed
 * note to fade before it speaks. Tips for controls
 * inside an open sheet render inside that <dialog> (the top layer); with a sheet open, only its
 * controls carry tips.
 *
 * Page notes live in document coordinates (ADR 0181): the layer scrolls with the page, so a note
 * stays on its control through every scroll (wheel glides, jumps, touch) without chasing it frame
 * by frame. A scroll only re-decides *whether* a note shows: when its control leaves the screen
 * the note goes (another copy of the control, e.g. the dock's, may take it), and a note that has
 * faded out no longer paints.
 */
export interface Tips {
  readonly el: HTMLElement;
  /** re-evaluate which tips show and where (coalesced to one frame) */
  schedule(): void;
  visible(): TipId[];
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const FADE_MS = 700;

interface Host {
  el: HTMLElement;
  leaders: SVGSVGElement;
  /** an invisible note used to measure a tip's size before deciding where it goes (detached) */
  measure: HTMLElement;
}

interface Shown {
  note: HTMLElement;
  /** the note's words (the × sits beside them) */
  copy: HTMLElement;
  leader: SVGPathElement;
  host: Host;
  /** the control it is about (focus returns here when the note is dismissed from the keyboard) */
  anchor: HTMLElement | null;
}

const copyOf = (id: TipId) => getTip(id)?.copy ?? '';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** The focusable things of a control: itself, else the ones inside it (in order). */
function focusables(el: HTMLElement | null): HTMLElement[] {
  if (!el?.isConnected) return [];
  if (el.matches(FOCUSABLE)) return [el];
  return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
}

/** Where focus goes back to: the control itself, else the first focusable thing inside it. */
const focusTarget = (el: HTMLElement | null): HTMLElement | null => focusables(el)[0] ?? null;

function makeHost(): Host {
  const leaders = document.createElementNS(SVG_NS, 'svg');
  leaders.classList.add('tip-leaders');
  leaders.setAttribute('aria-hidden', 'true');
  const measure = h('p.tip.tip-measure', { 'aria-hidden': 'true' }, h('span.tip-copy'));
  const el = h('div.tips');
  el.append(leaders);
  return { el, leaders, measure };
}

/**
 * `resolve` may return several candidates for one anchor (a control that exists twice, e.g. on the
 * garden and in the dock): the note goes to the first one that is on screen and has room, in the
 * given order.
 */
export function createTips(
  ctx: UIContext,
  opts: { tipContext(): TipContext; resolve(anchor: string, id: string): HTMLElement | readonly HTMLElement[] | null },
): Tips {
  const { store } = ctx.deps;
  const main = makeHost();
  const dialogHosts = new WeakMap<HTMLDialogElement, Host>();
  const shown = new Map<TipId, Shown>();
  /** notes fading out (at most a moment; removed at once when another note comes in) */
  const leaving = new Set<Shown>();
  let raf: number | null = null;
  let current: TipId[] = [];
  /** after a dismissal: no new note until the dismissed one has faded (one quiet thing at a time) */
  let holding = false;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (!(r.width > 0 && r.height > 0)) return false;
    // inside a scrolling sheet: only while the control is actually scrolled into view
    const scroller = a.closest<HTMLElement>('.sheet-inner');
    if (scroller) {
      const s = scroller.getBoundingClientRect();
      if (r.bottom < s.top + 8 || r.top > s.bottom - 48) return false;
    }
    return r.bottom > 0 && r.top < window.innerHeight;
  };

  const drop = (t: Shown) => {
    t.note.remove();
    t.leader.remove();
    leaving.delete(t);
  };

  function retire(id: TipId, now = false): void {
    const t = shown.get(id);
    if (!t) return;
    shown.delete(id);
    if (now || ctx.deps.reducedMotion) {
      drop(t);
      return;
    }
    t.note.classList.remove('is-in');
    t.leader.classList.remove('is-in');
    t.note.dataset.leaving = 'true';
    leaving.add(t);
    setTimeout(() => drop(t), FADE_MS);
  }

  /** The gardener closed a note with its × (or Esc inside it): retire the tip for good. */
  function dismiss(id: TipId): void {
    const t = shown.get(id);
    const hadFocus = !!t && t.note.contains(document.activeElement);
    const anchor = t?.anchor ?? null;
    retire(id);
    holding = true;
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = setTimeout(
      () => {
        holdTimer = null;
        holding = false;
        schedule();
      },
      ctx.deps.reducedMotion ? 0 : ctx.delay(FADE_MS),
    );
    ctx.deps.controller.retireTip(id, 'dismissed');
    // keyboard: focus goes back to the control the note was about, not to the top of the page
    if (hadFocus) focusTarget(anchor)?.focus({ preventScroll: true });
    schedule();
  }

  /** A note: its words and a small inked × that dismisses it (a real button, ADR 0211). */
  function makeNote(id: TipId, cls: string): { note: HTMLElement; copy: HTMLElement } {
    const copy = h('span.tip-copy', {}, copyOf(id));
    const x = h(
      'button.icon-btn.tip-x',
      { type: 'button', 'aria-label': `Dismiss tip: ${copyOf(id)}`, onclick: () => dismiss(id) },
      fragment(ICONS.close),
    );
    const note = h(`p.${cls}`, { 'data-tip-id': id, role: 'note' }, copy, x);
    note.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // the note's own Esc: not the sheet's, the placement's or the plant card's
      e.preventDefault();
      e.stopPropagation();
      dismiss(id);
    });
    return { note, copy };
  }

  function ensure(id: TipId, host: Host, anchor: HTMLElement): Shown {
    const existing = shown.get(id);
    if (existing && existing.host === host) {
      existing.anchor = anchor;
      return existing;
    }
    if (existing) retire(id, true);
    const { note, copy } = makeNote(id, 'tip');
    const leader = document.createElementNS(SVG_NS, 'path');
    leader.classList.add('tip-leader');
    leader.dataset.tipId = id;
    host.el.appendChild(note);
    host.leaders.appendChild(leader);
    const t: Shown = { note, copy, leader, host, anchor };
    shown.set(id, t);
    requestAnimationFrame(() => {
      if (shown.get(id) !== t) return;
      note.classList.add('is-in');
      leader.classList.add('is-in');
    });
    return t;
  }

  /** A note's size for this tip in this host (its live note when shown, else the measuring one). */
  function sizeOf(id: TipId, host: Host): { w: number; h: number } {
    const live = shown.get(id);
    if (live && live.host === host) {
      setText(live.copy, copyOf(id));
      return { w: live.note.offsetWidth, h: live.note.offsetHeight };
    }
    // measured in place for a moment (never left in the page, where it would count as a note); the
    // × is absolutely placed in the note's own padding, so the words alone give the size
    setText(host.measure.firstElementChild!, copyOf(id));
    host.el.appendChild(host.measure);
    const size = { w: host.measure.offsetWidth, h: host.measure.offsetHeight };
    host.measure.remove();
    return size;
  }

  function spotFor(id: TipId, anchor: HTMLElement, avoid: Box[]): TipSpot | null {
    const a = anchor.getBoundingClientRect();
    const container = anchor.closest<HTMLElement>('[data-ui]')?.getBoundingClientRect() ?? a;
    return placeTip(tipSides(id), a, container, sizeOf(id, hostFor(anchor)), { w: window.innerWidth, h: window.innerHeight }, avoid);
  }

  /** Draw a placed note in its host's own coordinates (the page for page notes). */
  function apply(t: Shown, spot: TipSpot): void {
    const o = t.host.el.getBoundingClientRect();
    // the `translate` property, not `transform`: it applies outside the slip's small `rotate`, so a
    // long way down the page does not swing the note sideways
    t.note.style.translate = `${(spot.left - o.left).toFixed(0)}px ${(spot.top - o.top).toFixed(0)}px`;
    t.note.dataset.side = spot.side;
    const { x1, y1, x2, y2 } = spot.leader;
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
    const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
    const p = (x: number, y: number) => `${(x - o.left).toFixed(1)} ${(y - o.top).toFixed(1)}`;
    t.leader.setAttribute('d', `M${p(x1, y1)}Q${p(mx, my)} ${p(x2, y2)}`);
  }

  const inlineHost: Host = { el: h('div'), leaders: document.createElementNS(SVG_NS, 'svg'), measure: h('p') };

  function placeInline(id: TipId, anchor: HTMLElement): void {
    const container = anchor.closest<HTMLElement>('.step') ?? anchor.parentElement!;
    const existing = shown.get(id);
    if (existing && existing.host === inlineHost && existing.note.parentElement === container) {
      setText(existing.copy, copyOf(id));
      existing.anchor = anchor;
      return;
    }
    if (existing) retire(id, true);
    const { note, copy } = makeNote(id, 'tip.tip-inline');
    const leader = document.createElementNS(SVG_NS, 'path');
    container.appendChild(note);
    const t: Shown = { note, copy, leader, host: inlineHost, anchor };
    shown.set(id, t);
    requestAnimationFrame(() => {
      if (shown.get(id) === t) note.classList.add('is-in');
    });
  }

  function layout(): void {
    raf = null;
    const root = ctx.deps.root;
    const openDialog = [...root.querySelectorAll<HTMLDialogElement>('dialog[open]')].find((d) => !d.classList.contains('is-closing')) ?? null;
    const anyClosing = root.querySelector('dialog.is-closing') !== null;
    // one quiet thing at a time: notes wait while the quiet line is speaking (a bloom, a koi)
    const lineSpeaking = !openDialog && root.querySelector('.quiet-line.is-in') !== null;
    // …and while a plant's card is being read (the camera's plant card, ADR 0167)
    const cardOpen = !openDialog && root.querySelector('[data-ui="plant-card"]:not([hidden])') !== null;
    const active = holding || anyClosing || lineSpeaking || cardOpen ? [] : activeTips(store.get(), opts.tipContext());
    const narrow = window.innerWidth < 600;
    // notes keep clear of the other slips on the painting and of the dock's section headings
    const avoid: Box[] = openDialog
      ? []
      : [...root.querySelectorAll<HTMLElement>('[data-ui], .dock-title')].filter((n) => !n.hidden).map((n) => n.getBoundingClientRect());
    const placed = new Map<TipId, { anchor: HTMLElement; spot: TipSpot | null }>();
    const next = pickTips(active, (anchor, id) => {
      const found = opts.resolve(anchor, id);
      for (const c of Array.isArray(found) ? found : [found]) {
        const a = c as HTMLElement | null;
        if (!isVisible(a)) continue;
        const inDialog = a.closest('dialog');
        if (openDialog ? inDialog !== openDialog : inDialog !== null) continue;
        if (narrow && inDialog) {
          // phones: inside a sheet the note sits inline at the end of its step (no room to float)
          placed.set(id, { anchor: a, spot: null });
          return true;
        }
        const spot = spotFor(id, a, avoid);
        if (!spot) continue; // half off screen or no room around it: try the other copy, else wait
        placed.set(id, { anchor: a, spot });
        avoid.push(spot);
        return true;
      }
      return false;
    });
    for (const id of [...shown.keys()]) if (!next.includes(id)) retire(id);
    // a new note never shares the page with one still fading out
    if (next.some((id) => !shown.has(id))) for (const t of [...leaving]) drop(t);
    for (const id of next) {
      const { anchor, spot } = placed.get(id)!;
      if (!spot) {
        placeInline(id, anchor);
        continue;
      }
      const t = ensure(id, hostFor(anchor), anchor);
      setText(t.copy, copyOf(id));
      // a note on the painting dims with the garden's light; one on the page does not (ADR 0121)
      t.note.dataset.on = anchor.closest('.stage') ? 'stage' : 'page';
      apply(t, spot);
    }
    current = next;
  }

  /**
   * Keyboard order (ADR 0211): the notes live in their own layer, far from their controls in the
   * page's order, so Tab is threaded by hand, both ways: control → its note's × → whatever follows
   * the control. "The control" is its last focusable part. Tab from the × puts focus back on the
   * control and lets the browser's own Tab move on from there; Shift+Tab from the × goes back to the
   * control; and a Shift+Tab that lands on the control from what follows it stops at the × first.
   */
  const threaded = () =>
    [...shown.values()].flatMap((t) => {
      const x = t.note.querySelector<HTMLElement>('.tip-x');
      const last = focusables(t.anchor).at(-1);
      // an inline note (phones, in a sheet) already follows its control in the page's order
      return x && last && t.host !== inlineHost && t.note.classList.contains('is-in') ? [{ x, last }] : [];
    });
  /** a Shift+Tab is moving focus backwards from somewhere other than a × */
  let backwards = false;
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    for (const { x, last } of threaded()) {
      if (active === x) {
        last.focus({ preventScroll: true });
        if (e.shiftKey) e.preventDefault(); // else the browser's Tab moves on from the control
        return;
      }
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        x.focus({ preventScroll: true });
        return;
      }
    }
    if (e.shiftKey) {
      backwards = true;
      setTimeout(() => (backwards = false), 0);
    }
  };
  const onFocusin = (e: FocusEvent) => {
    if (!backwards) return;
    backwards = false;
    const hit = threaded().find((t) => t.last === e.target);
    if (hit) hit.x.focus({ preventScroll: true });
  };
  document.addEventListener('keydown', onKeydown, { capture: true });
  document.addEventListener('focusin', onFocusin, { capture: true });

  const schedule = () => {
    raf ??= requestAnimationFrame(layout);
  };
  window.addEventListener('resize', schedule);
  // the page or a sheet scrolled: decide again which notes are on screen (they move with the page)
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  void document.fonts?.ready.then(schedule);

  return {
    el: main.el,
    schedule,
    visible: () => [...current],
    dispose() {
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, { capture: true });
      document.removeEventListener('keydown', onKeydown, { capture: true });
      document.removeEventListener('focusin', onFocusin, { capture: true });
      if (raf !== null) cancelAnimationFrame(raf);
      if (holdTimer !== null) clearTimeout(holdTimer);
    },
  };
}
