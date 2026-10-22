import { brushStrokePath } from './brush-path';
import { h } from './dom';
import { scrollForThumb, thumbGeometry } from './scroll-math';
import type { SmoothScroll } from './smooth-scroll';

/**
 * The custom scrollbar (ADR 0131): a faint hand-ruled track in the page's right margin and a sumi
 * brush stroke for the thumb. It shows where the page is, can be dragged (and clicked on the
 * track to glide there), and fades out when the page is still. The native bar is hidden in CSS.
 * It is pointer-only decoration over the document's own scrolling: `aria-hidden`, never
 * focusable, so keyboard scrolling and focus order are the browser's.
 */
export interface Scrollbar {
  readonly el: HTMLElement;
  /** re-measure (the page length changed) */
  update(): void;
  state(): { visible: boolean; scrollable: boolean; thumb: { top: number; size: number }; dragging: boolean };
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const IDLE_MS = 1300;
const INSET = 12; // track inset from the viewport's top and bottom
const HOT_EDGE = 28; // a pointer this close to the right edge wakes the bar

export function createScrollbar(scroller: SmoothScroll, opts: { win?: Window; delay?: (ms: number) => number } = {}): Scrollbar {
  const win = opts.win ?? window;
  const delay = opts.delay ?? ((ms: number) => ms);

  const svg = (cls: string) => {
    const s = win.document.createElementNS(SVG_NS, 'svg');
    s.classList.add(cls);
    s.setAttribute('aria-hidden', 'true');
    const p = win.document.createElementNS(SVG_NS, 'path');
    s.appendChild(p);
    return { s, p };
  };
  const track = svg('scroll-track');
  const thumbArt = svg('scroll-thumb-art');
  const thumb = h('div.scroll-thumb', {}, thumbArt.s);
  const el = h('div.scrollbar', { 'aria-hidden': 'true', 'data-scrollbar': '' }, track.s, thumb);

  let trackLen = 0;
  let thumbSize = 0;
  let thumbTop = 0;
  let drawnSize = -1;
  let drawnTrack = -1;
  let scrollable = false;
  let visible = false;
  let dragging: { pointer: number; grab: number } | null = null;
  let idle: ReturnType<typeof setTimeout> | null = null;

  function wake(): void {
    if (!scrollable) return;
    if (!visible) {
      visible = true;
      el.classList.add('is-awake');
    }
    if (idle !== null) clearTimeout(idle);
    idle = setTimeout(() => {
      idle = null;
      if (dragging || el.matches(':hover')) return wake();
      visible = false;
      el.classList.remove('is-awake');
    }, delay(IDLE_MS));
  }

  function layout(): void {
    const s = scroller.state();
    scrollable = s.max > 1;
    el.hidden = !scrollable;
    trackLen = Math.max(0, win.innerHeight - INSET * 2);
    const g = thumbGeometry(s.y, s.max, win.innerHeight, trackLen, 48);
    thumbSize = g.size;
    thumbTop = g.offset;
    if (Math.abs(drawnSize - thumbSize) > 1.5) {
      drawnSize = thumbSize;
      thumbArt.s.setAttribute('viewBox', `0 0 10 ${thumbSize.toFixed(1)}`);
      thumbArt.s.setAttribute('height', thumbSize.toFixed(1));
      thumbArt.p.setAttribute('d', brushStrokePath('scroll-thumb', { length: thumbSize, width: 6.2, wobble: 0.16 }));
      thumb.style.height = `${thumbSize.toFixed(1)}px`;
    }
    if (Math.abs(drawnTrack - trackLen) > 1.5) {
      drawnTrack = trackLen;
      track.s.setAttribute('viewBox', `0 0 10 ${trackLen.toFixed(1)}`);
      track.s.setAttribute('height', trackLen.toFixed(1));
      track.p.setAttribute('d', brushStrokePath('scroll-track', { length: trackLen, width: 1.3, wobble: 0.5, steps: 40 }));
    }
    thumb.style.transform = `translateY(${thumbTop.toFixed(1)}px)`;
  }

  const offChange = scroller.onChange(() => {
    layout();
    wake();
  });

  // dragging the thumb follows the pointer exactly (no smoothing: the hand is the easing)
  thumb.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    thumb.setPointerCapture?.(e.pointerId);
    dragging = { pointer: e.pointerId, grab: e.clientY - INSET - thumbTop };
    el.classList.add('is-dragging');
    wake();
  });
  thumb.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== dragging.pointer) return;
    const s = scroller.state();
    void scroller.scrollTo(scrollForThumb(e.clientY - INSET - dragging.grab, thumbSize, trackLen, s.max), { instant: true });
  });
  const endDrag = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== dragging.pointer) return;
    dragging = null;
    el.classList.remove('is-dragging');
    wake();
  };
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);
  // a click on the track glides so the thumb centres on the click
  el.addEventListener('pointerdown', (e) => {
    if (e.target !== el && e.target !== track.s && !track.s.contains(e.target as Node)) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const s = scroller.state();
    void scroller.scrollTo(scrollForThumb(e.clientY - INSET - thumbSize / 2, thumbSize, trackLen, s.max));
    wake();
  });

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.clientX >= win.innerWidth - HOT_EDGE) wake();
  };
  const onResize = () => layout();
  win.addEventListener('pointermove', onPointerMove, { passive: true });
  win.addEventListener('resize', onResize);
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => layout());
  ro?.observe(win.document.body);

  layout();

  return {
    el,
    update: layout,
    state: () => ({ visible, scrollable, thumb: { top: thumbTop + INSET, size: thumbSize }, dragging: dragging !== null }),
    dispose() {
      offChange();
      ro?.disconnect();
      if (idle !== null) clearTimeout(idle);
      win.removeEventListener('pointermove', onPointerMove);
      win.removeEventListener('resize', onResize);
    },
  };
}
