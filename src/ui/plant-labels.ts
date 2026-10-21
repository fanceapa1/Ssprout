import type { PlantInstance } from '../core/state';
import { plantWorldEdges } from '../plants/bounds';
import type { SpeciesDef } from '../plants/types';
import type { Pt } from '../render/viewport';
import type { Slot } from '../scene/geometry';
import type { UIContext } from './context';
import { h, setText } from './dom';
import { formatDay } from './format';

/**
 * Hover (or tap) a finished plant → a tiny ink label: task name · minutes · date (SPEC §3).
 * A DOM hit-test over the slot positions and species sprite boxes; never blocks the canvas.
 */
export interface PlantLabels {
  readonly el: HTMLElement;
  current(): string | null;
  /** label for the plant at a world point (tests/dev) */
  showAt(world: Pt): string | null;
  hide(): void;
  dispose(): void;
}

/** World-space sprite box of a placed plant: exactly the box the plant system draws into. */
export function plantBox(def: Pick<SpeciesDef, 'size' | 'anchor'>, slot: Pick<Slot, 'x' | 'y' | 'scale'>): { left: number; top: number; right: number; bottom: number } {
  return plantWorldEdges(def, slot);
}

/** The frontmost plant whose (slightly inset) box contains `p`. */
export function hitPlant(
  p: Pt,
  plants: readonly PlantInstance[],
  slotById: ReadonlyMap<string, Slot>,
  getSpecies: (id: string) => SpeciesDef | undefined,
): PlantInstance | null {
  let best: PlantInstance | null = null;
  let bestY = -Infinity;
  for (const plant of plants) {
    const slot = slotById.get(plant.slotId);
    const def = getSpecies(plant.speciesId);
    if (!slot || !def) continue;
    const b = plantBox(def, slot);
    // sprites have air around them: shrink the box a little horizontally, keep a grab margin at the base
    const inset = (b.right - b.left) * 0.12;
    if (p.x >= b.left + inset && p.x <= b.right - inset && p.y >= b.top && p.y <= b.bottom + 6 && slot.y > bestY) {
      best = plant;
      bestY = slot.y;
    }
  }
  return best;
}

export function plantLabelText(plant: PlantInstance & { taskName?: string }, def?: Pick<SpeciesDef, 'name'>): string {
  const task = plant.taskName?.trim() || def?.name || 'A plant';
  return `${task} · ${plant.sessionMinutes} min · ${formatDay(plant.plantedAt)}`;
}

export function createPlantLabels(ctx: UIContext, canvas: HTMLElement | null): PlantLabels {
  const { store, getSpecies, slots } = ctx.deps;
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const text = h('span.plant-label-text');
  const el = h('p.plant-label', { 'aria-hidden': 'true' }, text);
  let shown: string | null = null;
  let shownId: string | null = null;

  const calm = () => ctx.mode() === 'garden' && ctx.openDialogs().length === 0;

  function showFor(plant: PlantInstance | null): string | null {
    if (!plant) {
      hide();
      return null;
    }
    const def = getSpecies(plant.speciesId);
    const slot = slotById.get(plant.slotId);
    if (!def || !slot) return null;
    const label = plantLabelText(plant, def);
    const vp = ctx.deps.viewport();
    const b = plantBox(def, slot);
    const top = vp.worldToScreen({ x: slot.x, y: b.top });
    setText(text, label);
    el.dataset.plantId = plant.id;
    el.style.transform = `translate(${top.x.toFixed(0)}px, ${Math.max(8, top.y - 6).toFixed(0)}px) translate(-50%, -100%)`;
    el.classList.add('is-in');
    shown = label;
    shownId = plant.id;
    return label;
  }

  function hide(): void {
    if (!shown) return;
    el.classList.remove('is-in');
    shown = null;
    shownId = null;
  }

  const at = (e: PointerEvent): PlantInstance | null => {
    const r = canvas?.getBoundingClientRect();
    const p = ctx.deps.viewport().screenToWorld({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
    return hitPlant(p, store.get().plants, slotById, getSpecies);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (!calm() || e.target !== canvas) return hide();
    const p = at(e);
    if (p?.id !== shownId) showFor(p);
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    if (!calm() || e.target !== canvas) return hide();
    const p = at(e);
    if (!p || p.id === shownId) hide();
    else showFor(p);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });

  return {
    el,
    current: () => shown,
    showAt: (p) => showFor(hitPlant(p, store.get().plants, slotById, getSpecies)),
    hide,
    dispose() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
    },
  };
}
