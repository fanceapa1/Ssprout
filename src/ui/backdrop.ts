import { SHEET, grainOffset, sheetMaskSvg, sheetShadowSvg, svgData, type SheetStrength } from './backdrop-sheet';

/**
 * A backdrop behind a dock section (ADR 0208): a leaf of the page's own washi, lifted a little
 * lighter, with a torn edge (an SVG mask) and a pooled wash under it (an SVG background). The two
 * images are drawn for the section's size in CSS pixels, so the tear never stretches. They are drawn
 * again only when the section's size changes (a ResizeObserver, coalesced into one frame): content
 * growing, the waiting card arriving, a resize. Nothing repaints per frame or on scroll.
 *
 * Markup, the section's first child, behind its content:
 *   div.backdrop[data-strength][data-paints] > div.backdrop-shadow + div.backdrop-leaf
 */
export interface Backdrop {
  readonly el: HTMLElement;
  readonly strength: SheetStrength;
  /** draw now if the size changed (normally scheduled on its own) */
  layout(): void;
  /** how many times the images were drawn */
  paints(): number;
  dispose(): void;
}

export function createBackdrop(host: HTMLElement, opts: { seed: string; strength?: SheetStrength }): Backdrop {
  const strength = opts.strength ?? 'leaf';
  const style = SHEET[strength];
  const doc = host.ownerDocument;
  const el = doc.createElement('div');
  el.className = 'backdrop';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.strength = strength;
  const shadow = doc.createElement('div');
  shadow.className = 'backdrop-shadow';
  const leaf = doc.createElement('div');
  leaf.className = 'backdrop-leaf';
  el.append(shadow, leaf);
  const g = grainOffset(opts.seed);
  el.style.setProperty('--sheet-grain', `${-g.x}px ${-g.y}px`);
  el.style.setProperty('--sheet-lift', String(style.lift));
  host.prepend(el);

  let w = 0;
  let h = 0;
  let count = 0;
  let raf: number | null = null;
  let disposed = false;

  function layout(): void {
    raf = null;
    if (disposed) return;
    const nw = Math.round(host.offsetWidth);
    const nh = Math.round(host.offsetHeight);
    if (nw <= 0 || nh <= 0 || (nw === w && nh === h)) return;
    w = nw;
    h = nh;
    // a narrow sheet (a phone) casts a shallower wash: the same weight would read heavy beside it
    const st = w < 520 ? { ...style, depth: style.depth * 0.66 } : style;
    el.style.setProperty('--sheet-mask', svgData(sheetMaskSvg(opts.seed, w, h, st)));
    el.style.setProperty('--sheet-shadow', svgData(sheetShadowSvg(opts.seed, w, h, st)));
    count++;
    el.dataset.paints = String(count);
    el.dataset.size = `${w}x${h}`;
  }
  const schedule = () => {
    if (raf !== null || disposed) return;
    raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(layout) : (layout(), null);
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  ro?.observe(host);
  schedule();

  return {
    el,
    strength,
    layout,
    paints: () => count,
    dispose() {
      disposed = true;
      if (raf !== null) cancelAnimationFrame(raf);
      ro?.disconnect();
      el.remove();
    },
  };
}
