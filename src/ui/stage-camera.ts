import { inProgressSessions } from '../core/state';
import type { CameraReason } from '../render/camera';
import type { Pt } from '../render/viewport';
import { plantWorldBounds } from '../plants/bounds';
import type { UIContext } from './context';
import { fragment, h } from './dom';
import { ICONS } from './icons';
import type { CardPlacement, PlantCard } from './plant-card';
import type { PlantLabels } from './plant-labels';
import type { Stage } from './stage';
import type { CameraIntegration, PlacementHighlight, PlantHitInfo } from './types';

/**
 * The camera on the stage (SPEC §12a, ADRs 0005, 0162–0164, 0168): what the gardener does to look
 * closer, and when the garden looks closer by itself.
 * - Plain wheel scrolls the page (as before). ctrl/⌘ + wheel and trackpad pinch zoom about the
 *   pointer; a two-finger pinch zooms on touch. Double-click / double-tap zooms in (at the closest
 *   view: back to the whole garden). Drag pans, only while zoomed in: at the overview a finger
 *   scrolls the page (`touch-action: pan-x pan-y`), zoomed in it pans the painting (`none`).
 * - On-canvas + / − and "Whole garden" chips (bottom right, above the pill on narrow stages),
 *   and +, −, 0 and the arrow keys when the garden (the canvas, a tab stop) has focus; Enter opens
 *   the card of the plant nearest the middle of the view.
 * - Click or tap a plant: the camera glides onto it and its card opens (plant-card.ts). A click
 *   on bare garden, a click elsewhere on the page or Esc closes it. The cursor shows a hand over
 *   plants and a grab hand while zoomed.
 * - A session starting, or a switch to another session, glides to its seedling; entering
 *   placement glides back to the whole garden (ADR 0168). Nothing else re-zooms: once the
 *   gardener zooms out, the camera stays out until the next start or switch.
 */
export interface StageCamera {
  readonly controls: HTMLElement;
  /** open a plant's card (and glide onto it), as a click would; false when the plant is unknown */
  openCard(id: string): boolean;
  /** dev/tests: follow session starts and switches (default on) */
  setAutoFocus(on: boolean): void;
  state(): { touchAction: string; cursor: string; autoFocus: boolean };
  dispose(): void;
}

export interface StageCameraDeps {
  stage: Stage;
  integration: CameraIntegration;
  card: PlantCard;
  labels: PlantLabels;
  placement: { subscribe(fn: (h: PlacementHighlight) => void): () => void };
}

/** One wheel notch of ctrl/⌘ + wheel ≈ ×1.35; a trackpad pinch sends many small deltas. */
const WHEEL_K = 0.005;
const WHEEL_MAX_DELTA = 60;
/** + / − and the keys */
const STEP = 1.6;
/** a click or tap may wander this far (CSS px) before it is a drag */
const DRAG_SLOP = 6;
/** stage widths below this dock the card at the bottom */
const DOCK_BELOW = 640;
const DOUBLE_TAP_MS = 320;
/** CSS px of slack around a plant's painted pixels for clicks and the cursor */
const HIT_SLACK = 6;

interface Pointer {
  id: number;
  type: string;
  x: number;
  y: number;
  x0: number;
  y0: number;
  t0: number;
  moved: boolean;
}

export function createStageCamera(ctx: UIContext, deps: StageCameraDeps): StageCamera {
  const { stage, integration, card, labels } = deps;
  const { camera } = integration;
  const canvas = stage.canvas;
  let autoFocus = true;
  let cursor = '';
  let lastTap: { t: number; x: number; y: number } | null = null;
  let lastPointerType = 'mouse';
  const pointers = new Map<number, Pointer>();
  let pinch: { d: number; c: Pt } | null = null;
  const offs: Array<() => void> = [];

  // ── controls ───────────────────────────────────────────────────────────────────────────────
  const zoomIn = h('button.icon-btn.zoom-btn', { type: 'button', 'aria-label': 'Zoom in', 'data-zoom': 'in', onclick: () => stepZoom(STEP) }, fragment(ICONS.zoomIn));
  const zoomOut = h('button.icon-btn.zoom-btn', { type: 'button', 'aria-label': 'Zoom out', 'data-zoom': 'out', onclick: () => stepZoom(1 / STEP) }, fragment(ICONS.zoomOut));
  const whole = h(
    'button.zoom-whole',
    { type: 'button', 'data-zoom': 'whole', onclick: () => wholeGarden() },
    fragment(ICONS.wholeGarden),
    h('span', {}, 'Whole garden'),
  );
  const controls = h('div.zoom-controls', { role: 'group', 'aria-label': 'Garden view', 'data-ui': 'zoom' }, whole, h('div.zoom-steps', {}, zoomIn, zoomOut));

  const view = () => camera.view();
  const toStage = (clientX: number, clientY: number): Pt => {
    const r = canvas?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };
  const slack = () => HIT_SLACK / view().scale;
  const hitAt = (p: Pt): PlantHitInfo | null => integration.hitTest(view().screenToWorld(p), slack());
  const inGarden = () => ctx.mode() === 'garden' && ctx.openDialogs().length === 0;

  function render(): void {
    const s = camera.state();
    const zoomed = !s.overview;
    zoomOut.disabled = !zoomed;
    zoomIn.disabled = s.pose.zoom >= s.maxZoom - 1e-3;
    whole.hidden = !zoomed;
    ctx.deps.root.classList.toggle('is-zoomed', zoomed);
    controls.dataset.zoom = s.pose.zoom.toFixed(2);
    if (canvas) {
      const ta = zoomed ? 'none' : 'pan-x pan-y';
      if (canvas.style.touchAction !== ta) canvas.style.touchAction = ta;
    }
    if (s.moving) labels.hide();
  }

  function setCursor(c: string): void {
    if (c === cursor || !canvas) return;
    cursor = c;
    canvas.style.cursor = c;
  }

  // ── moving the camera ──────────────────────────────────────────────────────────────────────
  function stepZoom(k: number): void {
    const z = camera.state().target?.zoom ?? camera.pose().zoom;
    if (k < 1 && z / k <= 1.0001) return wholeGarden();
    camera.zoomTo(z * k, undefined, { reason: 'user' });
  }

  function wholeGarden(): void {
    card.close({ restoreFocus: false });
    camera.overview({ reason: 'overview' });
  }

  function focusBox(box: PlantHitInfo['box'], reason: CameraReason, inset = {}): void {
    camera.focusRect(box, { reason, inset });
  }

  function placementFor(box: PlantHitInfo['box']): CardPlacement {
    const base = camera.base();
    if (base.cssW < DOCK_BELOW) return 'docked';
    const cx = box.x + box.w / 2;
    return cx < base.visible.x + base.visible.w / 2 ? 'right' : 'left';
  }

  function openCardFor(hit: Pick<PlantHitInfo, 'id' | 'box'>, focusCard: boolean): boolean {
    const where = placementFor(hit.box);
    if (!card.open(hit.id, where)) return false;
    labels.hide();
    const inset = card.inset();
    camera.setInset(inset);
    focusBox(hit.box, 'plant', inset);
    if (focusCard) card.focus(canvas);
    return true;
  }

  /** a plant's world box from the state (finished or in progress) */
  function boxOf(id: string): PlantHitInfo['box'] | null {
    const state = ctx.deps.store.get();
    const p = state.plants.find((x) => x.id === id) ?? inProgressSessions(state).find((x) => x.id === id);
    const def = p ? ctx.deps.getSpecies(p.speciesId) : undefined;
    const slot = p ? ctx.deps.slots.find((s) => s.id === p.slotId) : undefined;
    return def && slot ? plantWorldBounds(def, slot) : null;
  }

  function focusSession(id: string, reason: CameraReason): void {
    if (!autoFocus) return;
    const box = boxOf(id);
    if (!box) return;
    if (card.isOpen() && card.current()?.id !== id) card.close({ restoreFocus: false });
    focusBox(box, reason, card.isOpen() ? card.inset() : {});
  }

  // ── gestures ───────────────────────────────────────────────────────────────────────────────
  offs.push(
    stage.onZoomGesture((e) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const d = Math.max(-WHEEL_MAX_DELTA, Math.min(WHEEL_MAX_DELTA, e.deltaY * unit));
      camera.zoomBy(Math.exp(-d * WHEEL_K), toStage(e.clientX, e.clientY));
    }),
  );

  function tap(p: Pt, type: string): void {
    if (!inGarden()) return;
    if (type === 'touch') {
      const now = performance.now();
      if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
        lastTap = null;
        doubleAt(p);
        return;
      }
      lastTap = { t: now, x: p.x, y: p.y };
    }
    const hit = hitAt(p);
    if (hit) {
      if (card.current()?.id !== hit.id) openCardFor(hit, false);
      return;
    }
    if (card.isOpen()) card.close({ restoreFocus: false });
  }

  function doubleAt(p: Pt): void {
    if (hitAt(p)) return; // the first click already went to the plant
    const s = camera.state();
    if (s.pose.zoom >= s.maxZoom - 0.05) return wholeGarden();
    camera.zoomTo(s.pose.zoom * 2, p, { reason: 'user' });
  }

  const onDown = (e: PointerEvent) => {
    if (!canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
    lastPointerType = e.pointerType;
    const p = toStage(e.clientX, e.clientY);
    pointers.set(e.pointerId, { id: e.pointerId, type: e.pointerType, x: p.x, y: p.y, x0: p.x, y0: p.y, t0: performance.now(), moved: false });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Pointer, Pointer];
      a.moved = b.moved = true;
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      camera.interrupt();
      for (const q of pointers.values()) safeCapture(q.id);
    }
  };

  const safeCapture = (id: number) => {
    try {
      canvas?.setPointerCapture(id);
    } catch {
      /* the pointer is gone */
    }
  };

  const onMove = (e: PointerEvent) => {
    const q = pointers.get(e.pointerId);
    const p = toStage(e.clientX, e.clientY);
    if (!q) {
      // hover: a hand over plants, a grab hand while zoomed
      if (e.pointerType === 'mouse' && e.buttons === 0 && e.target === canvas) {
        setCursor(inGarden() && hitAt(p) ? 'pointer' : camera.isOverview() ? '' : 'grab');
      }
      return;
    }
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    q.x = p.x;
    q.y = p.y;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [Pointer, Pointer];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch.d > 0 && d > 0) camera.zoomBy(d / pinch.d, c, { instant: true });
      camera.panBy(c.x - pinch.c.x, c.y - pinch.c.y);
      pinch = { d, c };
      return;
    }
    if (!q.moved && Math.hypot(p.x - q.x0, p.y - q.y0) > DRAG_SLOP) {
      q.moved = true;
      if (!camera.isOverview()) {
        safeCapture(q.id);
        camera.interrupt();
        setCursor('grabbing');
      }
    }
    // drag pans only while zoomed in (at the overview the page scrolls, or nothing happens)
    if (q.moved && !camera.isOverview()) {
      e.preventDefault();
      camera.panBy(dx, dy);
    }
  };

  const onUp = (e: PointerEvent) => {
    const q = pointers.get(e.pointerId);
    if (!q) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (q.moved) {
      if (pointers.size === 0) setCursor(camera.isOverview() ? '' : 'grab');
      return;
    }
    if (performance.now() - q.t0 < 700) tap({ x: q.x, y: q.y }, q.type);
  };

  const onCancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  };

  const onDblClick = (e: MouseEvent) => {
    // touch double taps are recognised above (the browser may also send a dblclick)
    if (lastPointerType === 'touch' || !inGarden()) return;
    e.preventDefault();
    doubleAt(toStage(e.clientX, e.clientY));
  };

  const PAN_KEY = 90;
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    let used = true;
    if (k === '+' || k === '=') stepZoom(STEP);
    else if (k === '-' || k === '_') stepZoom(1 / STEP);
    else if (k === '0') wholeGarden();
    else if (k === 'ArrowLeft' && !camera.isOverview()) camera.panBy(PAN_KEY, 0);
    else if (k === 'ArrowRight' && !camera.isOverview()) camera.panBy(-PAN_KEY, 0);
    else if (k === 'ArrowUp' && !camera.isOverview()) camera.panBy(0, PAN_KEY);
    else if (k === 'ArrowDown' && !camera.isOverview()) camera.panBy(0, -PAN_KEY);
    else if ((k === 'Enter' || k === ' ') && inGarden()) {
      const v = view();
      const hit = nearestPlant({ x: v.cssW / 2, y: v.cssH / 2 });
      if (hit) openCardFor(hit, true);
      else used = false;
    } else used = false;
    if (used) e.preventDefault();
  };

  /** the plant whose painted part is nearest a stage point (keyboard: the middle of the view) */
  function nearestPlant(p: Pt): PlantHitInfo | null {
    const direct = hitAt(p);
    if (direct) return direct;
    const v = view();
    let best: PlantHitInfo | null = null;
    let bestD = Infinity;
    const state = ctx.deps.store.get();
    for (const x of [...state.plants, ...inProgressSessions(state)]) {
      const box = boxOf(x.id);
      if (!box) continue;
      const c = v.worldToScreen({ x: box.x + box.w / 2, y: box.y + box.h * 0.6 });
      if (c.x < 0 || c.y < 0 || c.x > v.cssW || c.y > v.cssH) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = integration.hitTest(v.screenToWorld(c), slack() * 4) ?? best;
      }
    }
    return best;
  }

  // a click elsewhere on the page closes the card
  const onDocDown = (e: PointerEvent) => {
    if (!card.isOpen()) return;
    const t = e.target as Node | null;
    if (!t || t === canvas || card.el.contains(t) || controls.contains(t)) return;
    card.close({ restoreFocus: false });
  };

  if (canvas) {
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'Your garden. Click a plant to read about it. Plus and minus zoom, 0 shows the whole garden, the arrow keys look around, Enter opens the plant in the middle.',
    );
    canvas.style.touchAction = 'pan-x pan-y';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('pointerdown', onDocDown, true);
  }

  // ── following the sessions ─────────────────────────────────────────────────────────────────
  offs.push(ctx.deps.bus.on('session:start', ({ session }) => focusSession(session.id, 'session')));
  offs.push(ctx.deps.bus.on('session:switch', ({ to }) => focusSession(to, 'switch')));
  let placing = false;
  offs.push(
    deps.placement.subscribe((hl) => {
      if (hl.active === placing) return;
      placing = hl.active;
      // choosing a spot: the whole garden is the map (markers still follow any zoom)
      if (placing) {
        card.close({ restoreFocus: false });
        camera.overview({ reason: 'placement' });
      }
    }),
  );
  offs.push(camera.onChange(() => render()));
  // the card gone: a view framed beside it glides back inside the painting
  offs.push(card.onClose(() => camera.setInset(null)));
  render();

  return {
    controls,
    openCard(id) {
      const box = boxOf(id);
      return box ? openCardFor({ id, box }, false) : false;
    },
    setAutoFocus(on) {
      autoFocus = on;
    },
    state: () => ({ touchAction: canvas?.style.touchAction ?? '', cursor, autoFocus }),
    dispose() {
      for (const off of offs.splice(0)) off();
      if (canvas) {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('dblclick', onDblClick);
        canvas.removeEventListener('keydown', onKey);
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('pointerdown', onDocDown, true);
    },
  };
}
