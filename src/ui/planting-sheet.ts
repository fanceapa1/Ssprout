import type { StartPrefill } from '../core/schedule';
import type { UIContext } from './context';
import { clear, h, setText } from './dom';
import { createDurationControl } from './duration';
import { habitatPhrase, TIER_WORDS } from './format';
import { createPlanLineSvg, planSummary, renderPlanLine } from './plan-line';
import { createSheet, type Sheet } from './sheet';
import type { PlantingDraft } from './types';

/**
 * The planting sheet (SPEC §2 "Planting a session"): one calm scrolling <dialog> — name the task,
 * choose the total time, a recommended study plan and the plant — then "Choose a spot" hands
 * over to placement mode. Selections live in the shared draft so Back keeps them.
 */
export interface PlantingSheet extends Sheet {
  /** re-read plans/species (e.g. after the garden changed) */
  refill(): void;
  /**
   * Paint every species preview ahead in the plant view's worker, at idle priority (ADR 0222):
   * after the garden's first paint and when a Start control is pointed at or focused.
   */
  prewarm(): void;
  /** Resolves once every card on the sheet shows its preview (tests, shots). */
  previewsReady(): Promise<void>;
}

export interface PlantingActions {
  chooseSpot(): void;
}

export const TASK_MAX = 40;

/**
 * Prefill the shared draft from a scheduled session (the waiting card's one-tap Start, ADR 0173):
 * the name always; the total only when the schedule has one (else the remembered total stays);
 * the plan only when given and offered for that total (else the sheet's usual first plan). Plant
 * and spot are chosen now. `link` ties the session that begins to its occurrence.
 */
export function applyPrefill(draft: PlantingDraft, p: StartPrefill, plansFor: (minutes: number) => readonly { id: string }[]): void {
  draft.taskName = p.taskName.slice(0, TASK_MAX);
  if (p.goalMinutes !== null) draft.goalMinutes = p.goalMinutes;
  const offered = plansFor(draft.goalMinutes);
  if (p.planId !== null && offered.some((x) => x.id === p.planId)) draft.planId = p.planId;
  else if (p.goalMinutes !== null || !offered.some((x) => x.id === draft.planId)) draft.planId = null;
  draft.speciesId = null;
  draft.slotId = null;
  draft.link = p.link;
}

/** A normal start after a prefilled one: drop the link and the scheduled name. */
export function clearPrefill(draft: PlantingDraft): void {
  if (!draft.link) return;
  draft.link = null;
  draft.taskName = '';
}
const PREVIEW = { w: 96, h: 92 };
/** the preview options of a species card: its pixel size (DPR included) keys the prewarm */
const previewOptions = (id: string) => ({ ...PREVIEW, dpr: Math.min(2, window.devicePixelRatio || 1), seed: `preview:${id}` });

/** A card whose preview is on its way: the paper-toned plot shows until it lands. */
interface WaitingPreview {
  art: HTMLElement;
  canvas: HTMLCanvasElement;
  speciesId: string;
  hurried?: Promise<void>;
}
const TASK_SUGGESTIONS = ['Biology, chapter 4', 'Essay draft', 'Japanese vocabulary', 'Problem set 3', 'Reading for seminar'];

export function createPlantingSheet(ctx: UIContext, draft: PlantingDraft, actions: PlantingActions): PlantingSheet {
  const { controller } = ctx.deps;
  const sheet = createSheet(ctx, {
    name: 'planting',
    title: 'Plant a session',
    subtitle: h('p.sheet-sub', {}, 'Name what you’ll study, give it time, and choose what will grow while you do.'),
    className: 'planting',
    onOpen: () => {
      task.value = draft.taskName;
      duration.set(draft.goalMinutes);
      refill();
    },
  });

  // ── task ──
  const suggestion = TASK_SUGGESTIONS[Math.abs(Math.floor(ctx.deps.clock.now() / 86_400_000)) % TASK_SUGGESTIONS.length]!;
  const task = h('input.task-input', {
    type: 'text',
    id: 'task-name',
    maxLength: TASK_MAX,
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: suggestion,
    'data-anchor': 'task',
  });
  task.addEventListener('input', () => {
    draft.taskName = task.value.slice(0, TASK_MAX);
    // named it: the task tip has done its job, the next one (time) may speak
    if (draft.taskName.trim()) controller.retireTip('task');
    renderSummary();
  });
  task.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      duration.el.querySelector<HTMLInputElement>('input')?.focus();
    }
  });

  // ── time ──
  const duration = createDurationControl(draft.goalMinutes, (m, committed) => {
    draft.goalMinutes = m;
    refill();
    if (committed) {
      controller.updateSettings({ lastGoalMinutes: m });
      controller.retireTip('duration');
    }
  });

  // ── plan ──
  const plans = h('div.plans', { role: 'radiogroup', 'aria-labelledby': 'plan-heading', 'data-anchor': 'plan' });

  // ── plant ──
  const plants = h('ul.plants', { role: 'list', 'data-anchor': 'species' });
  const plantNote = h('p.step-note');

  // ── footer ──
  const summary = h('p.choice-summary', { 'aria-live': 'polite' });
  const spotBtn = h('button.seal.choose-spot', { type: 'button', disabled: true, onclick: () => actions.chooseSpot() }, 'Choose a spot');

  sheet.body.append(
    h(
      'section.step.step-task',
      {},
      h('label.step-title', { for: 'task-name' }, h('span.step-no', { 'aria-hidden': 'true' }, '一'), 'What are you studying?'),
      task,
    ),
    h('section.step.step-time', {}, h('h3.step-title', {}, h('span.step-no', { 'aria-hidden': 'true' }, '二'), 'How long'), duration.el),
    h('section.step.step-plan', {}, h('h3#plan-heading.step-title', {}, h('span.step-no', { 'aria-hidden': 'true' }, '三'), 'A plan for the time'), plans),
    h('section.step.step-plant', {}, h('h3.step-title', {}, h('span.step-no', { 'aria-hidden': 'true' }, '四'), 'What will grow'), plantNote, plants),
    h('div.sheet-foot.planting-foot', {}, summary, spotBtn),
  );

  function renderPlans(): void {
    const list = controller.recommendPlans(draft.goalMinutes);
    if (!list.some((p) => p.id === draft.planId)) draft.planId = list[0]?.id ?? null;
    clear(plans);
    for (const p of list) {
      const svg = createPlanLineSvg();
      renderPlanLine(svg, p.blocks, 220);
      const checked = p.id === draft.planId;
      const b = h(
        'button.plan-card',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(checked),
          tabindex: checked ? 0 : -1,
          'data-plan-id': p.id,
          onclick: () => selectPlan(p.id),
        },
        h('span.plan-name', {}, p.name),
        svg,
        h('span.plan-summary', {}, planSummary(p.blocks)),
      );
      plans.appendChild(b);
    }
  }
  // arrow keys move within the radio group
  plans.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    const cards = [...plans.querySelectorAll<HTMLButtonElement>('.plan-card')];
    const i = cards.findIndex((c) => c.dataset.planId === draft.planId);
    const next = cards[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : cards.length - 1)) % cards.length];
    if (next) {
      e.preventDefault();
      selectPlan(next.dataset.planId!);
      next.focus({ preventScroll: true });
    }
  });

  function selectPlan(id: string): void {
    draft.planId = id;
    controller.retireTip('plan');
    for (const c of plans.querySelectorAll<HTMLElement>('.plan-card')) {
      const on = c.dataset.planId === id;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    }
    renderSummary();
  }

  // ── previews (ADR 0222): never painted in the click; each card fills in as its sprite lands ──
  const waiting = new Map<HTMLElement, WaitingPreview>();
  let watcher: IntersectionObserver | null = null;
  let generation = 0;

  /** the selectable species in card order: earned tier first, then lower tiers, then locked */
  function orderedSpecies(list = controller.selectableSpecies(draft.goalMinutes)) {
    return [...list].sort((a, b) => Number(a.locked) - Number(b.locked) || Number(b.earned) - Number(a.earned) || b.species.tier - a.species.tier);
  }

  function land(w: WaitingPreview): void {
    if (waiting.get(w.art) !== w) return;
    waiting.delete(w.art);
    const drawn = ctx.previews.paintReady(w.canvas, w.speciesId, previewOptions(w.speciesId));
    // `landed` fades the plant in over its plot (ui.css); a card with nothing to draw keeps the plot
    w.art.dataset.preview = drawn ? 'landed' : 'none';
  }

  /** bring a card's preview to the front of the worker's queue and fill the card when it lands */
  function hurry(w: WaitingPreview): Promise<void> {
    w.hurried ??= ctx.previews
      .whenReady(w.speciesId, previewOptions(w.speciesId))
      .catch(() => false)
      .then(() => land(w));
    return w.hurried;
  }

  /** the cards on screen first; once those have landed, the rest */
  function watchPreviews(): void {
    const gen = ++generation;
    watcher?.disconnect();
    watcher = null;
    if (waiting.size === 0) return;
    if (typeof IntersectionObserver !== 'function') {
      for (const w of waiting.values()) void hurry(w);
      return;
    }
    let first = true;
    const observer = new IntersectionObserver((entries) => {
      const shown: Promise<void>[] = [];
      for (const e of entries) {
        const w = waiting.get(e.target as HTMLElement);
        if (w && e.isIntersecting) shown.push(hurry(w));
        if (!w) observer.unobserve(e.target);
      }
      if (!first) return;
      first = false;
      void Promise.all(shown).then(() => {
        if (gen !== generation || !sheet.isOpen()) return;
        for (const w of waiting.values()) void hurry(w);
      });
    });
    for (const art of waiting.keys()) observer.observe(art);
    watcher = observer;
  }

  function prewarm(): void {
    for (const s of orderedSpecies()) void ctx.previews.prewarm(s.species.id, previewOptions(s.species.id));
  }

  async function previewsReady(): Promise<void> {
    while (waiting.size > 0) await Promise.all([...waiting.values()].map(hurry));
  }

  function renderPlants(): void {
    const list = controller.selectableSpecies(draft.goalMinutes);
    // a species whose every spot holds another session's seedling would lead to a placement
    // with nowhere to plant: show it, say why, and keep it out of reach (ADR 0205)
    const full = new Set(list.filter((s) => !s.locked && controller.placementOptions(s.species.id).length === 0).map((s) => s.species.id));
    const current = list.find((s) => s.species.id === draft.speciesId);
    if (!current || current.locked || full.has(current.species.id)) {
      if (draft.speciesId) draft.slotId = null;
      draft.speciesId = null;
    }
    clear(plants);
    waiting.clear();
    const ordered = orderedSpecies(list);
    for (const s of ordered) {
      const def = s.species;
      const canvas = h('canvas.plant-preview', { 'aria-hidden': 'true' });
      canvas.style.width = `${PREVIEW.w}px`;
      canvas.style.height = `${PREVIEW.h}px`;
      // drawn now only if no sprite needs painting; else a quiet plot until it lands
      const drawn = ctx.previews.paintReady(canvas, def.id, previewOptions(def.id));
      const art = h('span.plant-art', { 'data-preview': drawn ? 'painted' : 'pending' }, canvas);
      if (!drawn) {
        ctx.previews.paintPlot(canvas, previewOptions(def.id));
        waiting.set(art, { art, canvas, speciesId: def.id });
      }
      const selected = draft.speciesId === def.id;
      const noSpot = full.has(def.id);
      const card = h(
        'button.plant-card',
        {
          type: 'button',
          'data-species-id': def.id,
          'data-tier': def.tier,
          'data-locked': String(s.locked),
          'data-earned': String(s.earned),
          'data-full': String(noSpot),
          'aria-pressed': String(selected),
          'aria-disabled': s.locked || noSpot ? 'true' : undefined,
          'aria-describedby': `plant-desc-${def.id}`,
          onclick: () => {
            if (s.locked || noSpot) return;
            if (draft.speciesId !== def.id) draft.slotId = null;
            draft.speciesId = def.id;
            for (const c of plants.querySelectorAll('.plant-card')) c.setAttribute('aria-pressed', String((c as HTMLElement).dataset.speciesId === def.id));
            renderSummary();
          },
        },
        art,
        h('span.plant-name', {}, def.name),
        def.nativeName ? h('span.plant-native', { lang: 'ja-Latn' }, def.nativeName) : null,
        h(
          'span.plant-desc',
          { id: `plant-desc-${def.id}` },
          s.locked ? `Needs ${s.requiredMinutes} min+` : noSpot ? 'Its spots all hold growing seedlings just now' : def.description,
        ),
        s.locked ? null : h('span.plant-habitat', {}, habitatPhrase(def.habitats)),
      );
      plants.appendChild(h('li', {}, card));
    }
    const tierWord = TIER_WORDS[ordered.find((s) => s.earned)?.species.tier ?? 1];
    setText(plantNote, `${draft.goalMinutes} minutes can grow up to a ${tierWord}.`);
    watchPreviews();
  }

  function renderSummary(): void {
    const plan = controller.recommendPlans(draft.goalMinutes).find((p) => p.id === draft.planId);
    const def = draft.speciesId ? ctx.deps.getSpecies(draft.speciesId) : undefined;
    const name = draft.taskName.trim() || 'Study session';
    setText(summary, def ? `${def.name} for “${name}” · ${draft.goalMinutes} min${plan ? ` · ${plan.name}` : ''}` : 'Choose a plant to continue.');
    spotBtn.disabled = !def || !plan;
  }

  function refill(): void {
    renderPlans();
    renderPlants();
    renderSummary();
    ctx.changed();
  }

  return { ...sheet, refill, prewarm, previewsReady };
}
