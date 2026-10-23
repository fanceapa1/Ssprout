import { h } from './dom';
import { stageEdgeCanvas } from './stage-edge';

/**
 * The garden stage (ADR 0130): the element that holds the canvas at the top of the page
 * (~94 % of the viewport height, ADR 0212, a small margin around it). The renderer sizes itself to the
 * canvas, which fills the stage, so the viewport follows the stage, not the window.
 * - `layer`: an overlay the size of the stage for everything that sits on the painting (timer pill,
 *   corner icons, quiet line, placement markers and bar, plant labels). Positions inside it are the
 *   renderer viewport's CSS pixels (`viewport.worldToScreen`), whatever the page's scroll.
 * - the painting's edge dissolves into the page's paper through a CSS mask (stage-edge.ts),
 *   regenerated only when the stage changes size.
 * - `onZoomGesture`: the hook reserved for the camera (ADR 0005). ctrl/⌘ + wheel over the garden
 *   (trackpad pinch arrives that way) never scrolls the page; when a handler is set it receives the
 *   event (default prevented), otherwise the browser does what it always does (page zoom).
 */
export interface Stage {
  readonly el: HTMLElement;
  readonly layer: HTMLElement;
  readonly canvas: HTMLCanvasElement | null;
  /** reserve ctrl/⌘ + wheel and trackpad pinch over the garden; returns an unsubscribe */
  onZoomGesture(fn: (e: WheelEvent) => void): () => void;
  /** whether the edge mask is applied (tests) */
  masked(): boolean;
  dispose(): void;
}

export function createStage(el: HTMLElement, canvas: HTMLCanvasElement | null): Stage {
  const layer = h('div.stage-ui');
  el.appendChild(layer);
  const zoom = new Set<(e: WheelEvent) => void>();
  let url: string | null = null;
  let size = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  function paintEdge(): void {
    if (!canvas) return;
    const r = el.getBoundingClientRect();
    const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
    if (key === size || r.width < 2 || r.height < 2) return;
    size = key;
    const mask = stageEdgeCanvas(r.width, r.height);
    if (!mask) return;
    mask.toBlob((blob) => {
      if (!blob) return;
      const next = URL.createObjectURL(blob);
      canvas.style.setProperty('mask-image', `url("${next}")`);
      canvas.style.setProperty('-webkit-mask-image', `url("${next}")`);
      canvas.dataset.edge = 'masked';
      if (url) URL.revokeObjectURL(url);
      url = next;
    });
  }

  const ro =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (timer !== null) clearTimeout(timer);
          // the first size at once (no hard edge on load), later ones after the resize settles
          timer = setTimeout(paintEdge, size ? 150 : 0);
        });
  ro?.observe(el);

  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey) || zoom.size === 0) return;
    e.preventDefault();
    for (const fn of [...zoom]) fn(e);
  };
  el.addEventListener('wheel', onWheel, { passive: false });

  return {
    el,
    layer,
    canvas,
    onZoomGesture(fn) {
      zoom.add(fn);
      return () => {
        zoom.delete(fn);
      };
    },
    masked: () => canvas?.dataset.edge === 'masked',
    dispose() {
      ro?.disconnect();
      if (timer !== null) clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
      if (url) URL.revokeObjectURL(url);
      layer.remove();
    },
  };
}
