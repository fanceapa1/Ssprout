import type { CompatibleSlot } from '../core/placement';
import type { Slot } from '../scene/geometry';
import { GARDEN_HABITAT_WORDS } from '../scenery/japanese-garden/flora';
import type { UIContext } from './context';
import { clear, fragment, h, setText } from './dom';
import { ICONS } from './icons';
import type { PlacementHighlight, PlantingDraft } from './types';

/**
 * Placement mode (SPEC §3 Placement): the rest of the UI steps back, compatible slots for the
 * draft's species appear as DOM markers over the canvas (`button[data-slot-id]`, positioned with
 * the renderer's viewport and re-positioned whenever it changes). Empty slots are glowing seed
 * dabs; occupied ones a swap marker ("Replace <name>? It will be pressed into your herbarium.").
 * Choosing a marker selects the spot; "Begin" starts the session. A tiny observable
 * (`highlight`) lets the renderer draw an in-canvas highlight if it wants to.
 */
export interface Placement {
  readonly bar: HTMLElement;
  readonly layer: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** slot ids of the markers currently shown */
  markers(): string[];
  /** first occupied marker (tip anchor for the swap hint) */
  firstSwapMarker(): HTMLElement | null;
  highlight: {
    current(): PlacementHighlight;
    subscribe(fn: (h: PlacementHighlight) => void): () => void;
  };
  dispose(): void;
}

export interface PlacementActions {
  begin(): void;
  back(): void;
}

const EMPTY: PlacementHighlight = { active: false, speciesId: null, slots: [], focused: null, selected: null };

export function createPlacement(ctx: UIContext, draft: PlantingDraft, actions: PlacementActions): Placement {
  const { controller, getSpecies } = ctx.deps;
  const words = () => ctx.deps.habitatWords?.() ?? GARDEN_HABITAT_WORDS;
  let open = false;
  let options: CompatibleSlot<Slot>[] = [];
  let focused: string | null = null;
  let lastViewport: unknown = null;
  let raf: number | null = null;
  const listeners = new Set<(h: PlacementHighlight) => void>();
  const buttons = new Map<string, HTMLButtonElement>();

  const prompt = h('p.placement-prompt');
  const back = h(
    'button.quiet.placement-back',
    { type: 'button', onclick: () => actions.back(), 'aria-label': 'Back to planting' },
    fragment(ICONS.back),
    h('span', {}, 'Back'),
  );
  const begin = h('button.seal.begin', { type: 'button', disabled: true, onclick: () => actions.begin() }, 'Begin');
  const bar = h('div.placement-bar.slip', { role: 'region', 'aria-label': 'Choose a spot', 'data-ui': 'placement', hidden: true }, back, prompt, begin);
  const layer = h('div.markers', { 'aria-label': 'Places to plant', role: 'group', hidden: true });

  const onKey = (e: KeyboardEvent) => {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      actions.back();
    }
  };

  function snapshot(): PlacementHighlight {
    if (!open) return EMPTY;
    return {
      active: true,
      speciesId: draft.speciesId,
      slots: options.map((o) => ({ id: o.slot.id, x: o.slot.x, y: o.slot.y, occupied: !!o.occupiedBy })),
      focused,
      selected: draft.slotId,
    };
  }

  function notify(): void {
    const snap = snapshot();
    for (const fn of [...listeners]) fn(snap);
    ctx.changed();
  }

  function occupantName(o: CompatibleSlot<Slot>): string {
    return (o.occupiedBy && getSpecies(o.occupiedBy.speciesId)?.name) || 'this plant';
  }

  function select(o: CompatibleSlot<Slot>): void {
    draft.slotId = o.slot.id;
    for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === o.slot.id));
    renderPrompt();
    notify();
  }

  function marker(o: CompatibleSlot<Slot>): HTMLButtonElement {
    const where = words()[o.slot.habitat];
    const name = occupantName(o);
    const label = o.occupiedBy ? `Replace ${name}, ${where}. It will be pressed into your herbarium.` : `Plant here, ${where}`;
    return h(
      'button.marker',
      {
        type: 'button',
        'data-slot-id': o.slot.id,
        'data-habitat': o.slot.habitat,
        'data-occupied': o.occupiedBy ? 'true' : 'false',
        'aria-label': label,
        'aria-pressed': String(draft.slotId === o.slot.id),
        style: { '--d': String((o.slot.x * 7 + o.slot.y * 3) % 2000) },
        onclick: () => select(o),
        ondblclick: () => {
          select(o);
          actions.begin();
        },
        onfocus: () => setFocused(o.slot.id),
        onblur: () => setFocused(null),
        onpointerenter: () => setFocused(o.slot.id),
        onpointerleave: () => setFocused(null),
      },
      h('span.dab', { 'aria-hidden': 'true' }),
      o.occupiedBy ? fragment(ICONS.swap) : h('span.seed', { 'aria-hidden': 'true' }),
      o.occupiedBy
        ? h('span.marker-note', { 'aria-hidden': 'true' }, `Replace ${name}?`, h('em', {}, ' It will be pressed into your herbarium.'))
        : null,
    );
  }

  function setFocused(id: string | null): void {
    if (focused === id) return;
    focused = id;
    notify();
  }

  function position(): void {
    const vp = ctx.deps.viewport();
    lastViewport = vp;
    for (const o of options) {
      const b = buttons.get(o.slot.id);
      if (!b) continue;
      const p = vp.worldToScreen(o.slot);
      b.hidden = !(p.x >= 8 && p.y >= 8 && p.x <= vp.cssW - 8 && p.y <= vp.cssH - 8);
      b.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    }
  }

  /** follow the renderer's viewport (it is replaced on every resize) */
  function watch(): void {
    raf = null;
    if (!open) return;
    if (ctx.deps.viewport() !== lastViewport) {
      position();
      notify();
    }
    raf = requestAnimationFrame(watch);
  }

  function renderPrompt(): void {
    const def = draft.speciesId ? getSpecies(draft.speciesId) : undefined;
    const name = def?.name ?? 'your plant';
    clear(prompt);
    const chosen = options.find((o) => o.slot.id === draft.slotId);
    if (options.length === 0) {
      setText(prompt, `There is no spot where ${name} can grow just now.`);
    } else if (!chosen) {
      prompt.append('Choose a softly glowing spot for ', h('strong', {}, name), '.');
    } else if (chosen.occupiedBy) {
      prompt.append(h('strong', {}, name), ` will take the place of ${occupantName(chosen)}.`);
    } else {
      prompt.append(h('strong', {}, name), ` will grow ${words()[chosen.slot.habitat]}.`);
    }
    begin.disabled = !chosen;
  }

  function build(): void {
    options = draft.speciesId ? controller.placementOptions(draft.speciesId) : [];
    if (!options.some((o) => o.slot.id === draft.slotId)) draft.slotId = null;
    clear(layer);
    buttons.clear();
    // keyboard order: back → front, left → right
    for (const o of [...options].sort((a, b) => a.slot.y - b.slot.y || a.slot.x - b.slot.x)) {
      const b = marker(o);
      buttons.set(o.slot.id, b);
      layer.appendChild(b);
    }
    renderPrompt();
    position();
  }

  return {
    bar,
    layer,
    open() {
      open = true;
      focused = null;
      build();
      bar.hidden = false;
      layer.hidden = false;
      ctx.deps.root.classList.add('is-placing');
      window.addEventListener('keydown', onKey);
      raf ??= requestAnimationFrame(watch);
      const first =
        layer.querySelector<HTMLButtonElement>('button.marker[aria-pressed="true"]:not([hidden])') ??
        layer.querySelector<HTMLButtonElement>('button.marker:not([hidden])');
      (first ?? back).focus({ preventScroll: true });
      notify();
    },
    close() {
      if (!open) return;
      open = false;
      bar.hidden = true;
      layer.hidden = true;
      clear(layer);
      buttons.clear();
      options = [];
      focused = null;
      ctx.deps.root.classList.remove('is-placing');
      window.removeEventListener('keydown', onKey);
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      notify();
    },
    isOpen: () => open,
    markers: () => [...buttons.keys()],
    firstSwapMarker: () => layer.querySelector<HTMLElement>('button.marker[data-occupied="true"]:not([hidden])'),
    highlight: {
      current: snapshot,
      subscribe(fn) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    },
    dispose() {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      listeners.clear();
    },
  };
}
