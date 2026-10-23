import { sessionTimeline, MINUTE_MS } from '../core/session';
import { inProgressSessions, type GardenState } from '../core/state';
import { speciesNote } from '../plants/notes';
import type { SpeciesDef } from '../plants/types';
import { CHEVRON, chevronSvg } from './calendar-art';
import type { UIContext } from './context';
import { clear, fragment, h, setText } from './dom';
import { formatDay, formatTimer, inSentence, spokenMinutes } from './format';
import { ICONS } from './icons';

/**
 * The plant card (SPEC §3a, ADR 0167): click a plant in the garden and the camera glides onto it
 * while a washi slip opens beside it — the species (and its Japanese name), a short note on its
 * place in Japanese gardens, its poetic line, and the plant's own story: what it was planted for,
 * how long was studied, when; a seedling's progress and time to go; what it replaced. On wide
 * stages the slip stands on the side away from the plant (the camera frames the plant in the rest
 * of the stage); on phones it docks at the bottom of the stage. Esc, the close mark or a click
 * elsewhere on the garden closes it; focus moves into it and back.
 *
 * When the card is taller than its room (a long note on a small phone), the name stays and the
 * rest scrolls inside the card: the words thin into the paper at the cut and a small ink mark
 * shows there is more; the scrolling part takes keyboard focus only then (ADR 0190).
 */

export interface PlantStory {
  id: string;
  kind: 'finished' | 'growing';
  speciesId: string;
  name: string;
  nativeName: string | null;
  /** the species' poetic line */
  line: string;
  /** its place in Japanese gardens and culture */
  note: string | null;
  task: string;
  plantedAt: number;
  /** focused minutes (a seedling: so far) */
  minutes: number;
  /** finished plants: when it bloomed */
  completedAt: number | null;
  growing: { growth: number; remainingMs: number; paused: boolean; waiting: boolean } | null;
  /** the plant it took the place of (pressed), or that steps aside for this seedling */
  replaced: { name: string; task: string | null } | null;
}

/** Everything the card says about a plant (pure: state + time + species). */
export function plantStory(state: GardenState, id: string, now: number, getSpecies: (id: string) => SpeciesDef | undefined): PlantStory | null {
  const plant = state.plants.find((p) => p.id === id);
  if (plant) {
    const def = getSpecies(plant.speciesId);
    const logged = state.log?.find((e) => e.id === id && e.outcome === 'completed');
    // the flower pressed when this plant bloomed in its place (the same moment)
    const pressed = state.pressed.find((p) => p.removedAt === plant.completedAt);
    const pressedDef = pressed ? getSpecies(pressed.speciesId) : undefined;
    return {
      id,
      kind: 'finished',
      speciesId: plant.speciesId,
      name: def?.name ?? 'A plant',
      nativeName: def?.nativeName ?? null,
      line: def?.description ?? '',
      note: speciesNote(plant.speciesId),
      task: plant.taskName?.trim() || 'Study session',
      plantedAt: plant.plantedAt,
      minutes: logged ? logged.focusedMinutes : plant.sessionMinutes,
      completedAt: plant.completedAt,
      growing: null,
      replaced: pressed ? { name: pressedDef?.name ?? 'a plant', task: pressed.taskName?.trim() || null } : null,
    };
  }
  const session = inProgressSessions(state).find((s) => s.id === id);
  if (!session) return null;
  const def = getSpecies(session.speciesId);
  const t = sessionTimeline(session, now);
  const displaced = session.displacedPlantId ? state.plants.find((p) => p.id === session.displacedPlantId) : undefined;
  const displacedDef = displaced ? getSpecies(displaced.speciesId) : undefined;
  return {
    id,
    kind: 'growing',
    speciesId: session.speciesId,
    name: def?.name ?? 'A seedling',
    nativeName: def?.nativeName ?? null,
    line: def?.description ?? '',
    note: speciesNote(session.speciesId),
    task: session.taskName?.trim() || 'Study session',
    plantedAt: session.startedAt,
    minutes: Math.floor(t.focusDoneMs / MINUTE_MS),
    completedAt: null,
    growing: { growth: t.growth, remainingMs: t.totalRemainingMs, paused: session.pausedAt !== null, waiting: state.session?.id !== session.id },
    replaced: displaced ? { name: displacedDef?.name ?? 'a plant', task: displaced.taskName?.trim() || null } : null,
  };
}

/** The story lines, as the card shows them (also read by tests). */
export function storyLines(s: PlantStory): { task: string; facts: string[]; replaced: string | null } {
  const facts: string[] = [];
  if (s.kind === 'finished') {
    facts.push(`${spokenMinutes(s.minutes)} of study`);
    facts.push(`planted ${formatDay(s.plantedAt)}`);
  } else if (s.growing) {
    const pct = `${Math.round(s.growing.growth * 100)}% grown`;
    if (s.growing.waiting) facts.push(`${pct}, waiting while you study something else`);
    else if (s.growing.paused) facts.push(`${pct}, resting while paused`);
    else facts.push(`${pct}, ${formatTimer(s.growing.remainingMs)} to go`);
    facts.push(`${spokenMinutes(s.minutes)} studied so far`);
    facts.push(`planted ${formatDay(s.plantedAt)}`);
  }
  let replaced: string | null = null;
  if (s.replaced) {
    const what = `${inSentence(s.replaced.name)}${s.replaced.task ? ` (“${s.replaced.task}”)` : ''}`;
    replaced =
      s.kind === 'finished'
        ? `It took the place of a ${what}, now pressed in your herbarium.`
        : `A ${what} steps aside for it; if you end this session, it comes back.`;
  }
  return { task: s.task, facts, replaced };
}

export type CardPlacement = 'left' | 'right' | 'docked';

export interface PlantCard {
  readonly el: HTMLElement;
  /** open (or switch to) a plant's card on a side of the stage; false when the plant is unknown */
  open(id: string, placement: CardPlacement): boolean;
  close(opts?: { restoreFocus?: boolean }): void;
  isOpen(): boolean;
  current(): { id: string; kind: 'finished' | 'growing' } | null;
  /** re-read the plant (a seedling's progress) */
  refresh(): void;
  /** the stage CSS px the card covers on its side (the camera frames the plant in the rest) */
  inset(): { top?: number; right?: number; bottom?: number; left?: number };
  /** focus moved in with the card (returns to `returnTo` on close) */
  focus(returnTo?: HTMLElement | null): void;
  onClose(fn: () => void): () => void;
  dispose(): void;
}

let cardCount = 0;

export function createPlantCard(ctx: UIContext): PlantCard {
  const { store, getSpecies, clock } = ctx.deps;
  const uid = `plant-card-${++cardCount}`;
  const title = h(`h2#${uid}-name.plant-story-name`);
  const native = h('p.plant-story-native');
  const line = h('p.plant-story-line');
  const note = h('p.plant-story-note');
  const storyTask = h('p.plant-story-task');
  const facts = h('ul.plant-story-facts', { role: 'list' });
  const replaced = h('p.plant-story-replaced');
  const closeBtn = h('button.icon-btn.plant-story-close', { type: 'button', 'aria-label': 'Close', onclick: () => api.close({ restoreFocus: true }) }, fragment(ICONS.close));
  const body = h(
    'div.plant-story-body',
    { 'aria-labelledby': `${uid}-name` },
    line,
    note,
    h('div.plant-story-history', {}, h('h3.plant-story-history-head', {}, 'Its story'), storyTask, facts, replaced),
  );
  // the mark at the cut: a pointer or a tap reads on (keyboard: the body itself scrolls)
  const more = h(
    'button.plant-story-more',
    { type: 'button', tabindex: -1, 'aria-hidden': 'true', onclick: () => readOn() },
    fragment(chevronSvg(CHEVRON.down)),
  );
  const el = h(
    'section.plant-story.slip',
    { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': `${uid}-name`, 'data-ui': 'plant-card', hidden: true, tabindex: '-1' },
    h('header.plant-story-head', {}, h('div.plant-story-titles', {}, title, native), closeBtn),
    body,
    more,
  );
  const reduced = () => ctx.deps.reducedMotion ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function readOn(): void {
    body.scrollBy({ top: Math.max(40, body.clientHeight * 0.7), behavior: reduced() ? 'auto' : 'smooth' });
  }
  /**
   * Is there more than the card shows? Marks the cut (`data-more="above below"`) and lets the
   * scrolling part take keyboard focus only while it scrolls (a region named after the plant).
   */
  function fit(): void {
    if (el.hidden) return;
    const over = body.scrollHeight - body.clientHeight > 1;
    const above = over && body.scrollTop > 1;
    const below = over && body.scrollTop + body.clientHeight < body.scrollHeight - 1;
    const want = [above ? 'above' : '', below ? 'below' : ''].filter(Boolean).join(' ');
    if ((el.dataset.more ?? '') !== want) {
      if (want) el.dataset.more = want;
      else delete el.dataset.more;
    }
    if (over) {
      body.tabIndex = 0;
      body.setAttribute('role', 'region');
    } else {
      body.removeAttribute('tabindex');
      body.removeAttribute('role');
    }
  }
  body.addEventListener('scroll', fit, { passive: true });
  const onResize = () => fit();
  const fitSoon = () => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => fit()) : fit());
  let shown: { id: string; kind: 'finished' | 'growing' } | null = null;
  let placement: CardPlacement = 'right';
  let returnTo: HTMLElement | null = null;
  const closeListeners = new Set<() => void>();

  function render(): boolean {
    if (!shown) return false;
    const story = plantStory(store.get(), shown.id, clock.now(), getSpecies);
    if (!story) return false;
    shown.kind = story.kind;
    el.dataset.kind = story.kind;
    el.dataset.plantId = story.id;
    el.dataset.speciesId = story.speciesId;
    setText(title, story.name);
    setText(native, story.nativeName ?? '');
    native.hidden = !story.nativeName;
    setText(line, story.line);
    line.hidden = !story.line;
    setText(note, story.note ?? '');
    note.hidden = !story.note;
    const lines = storyLines(story);
    clear(storyTask);
    storyTask.append(story.kind === 'growing' ? 'Growing for ' : 'Planted for ', h('span.plant-story-taskname', {}, `“${lines.task}”`));
    clear(facts);
    for (const f of lines.facts) facts.append(h('li', {}, f));
    setText(replaced, lines.replaced ?? '');
    replaced.hidden = !lines.replaced;
    fit();
    return true;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && shown) {
      e.preventDefault();
      api.close({ restoreFocus: true });
    }
  };

  const offTick = ctx.deps.controller.onTick(() => {
    if (shown?.kind === 'growing') render();
  });
  const offStore = store.subscribe(() => {
    if (!shown) return;
    queueMicrotask(() => {
      if (shown && !render()) api.close();
    });
  });

  const api: PlantCard = {
    el,
    open(id, where) {
      const fresh = el.hidden || shown?.id !== id;
      shown = { id, kind: 'finished' };
      if (!render()) {
        shown = null;
        return false;
      }
      placement = where;
      el.dataset.placement = where;
      el.hidden = false;
      if (fresh) body.scrollTop = 0;
      fit();
      fitSoon();
      ctx.deps.root.classList.add('has-plant-story');
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);
      ctx.changed();
      return true;
    },
    close(opts = {}) {
      if (!shown) return;
      const hadFocus = el.contains(document.activeElement);
      shown = null;
      el.hidden = true;
      ctx.deps.root.classList.remove('has-plant-story');
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      if (opts.restoreFocus !== false && hadFocus && returnTo?.isConnected) returnTo.focus({ preventScroll: true });
      returnTo = null;
      for (const fn of [...closeListeners]) fn();
      ctx.changed();
    },
    isOpen: () => shown !== null,
    current: () => (shown ? { ...shown } : null),
    refresh() {
      if (shown && !render()) api.close();
    },
    inset() {
      if (!shown) return {};
      const r = el.getBoundingClientRect();
      const stage = el.offsetParent?.getBoundingClientRect();
      if (!stage || r.width === 0) return {};
      if (placement === 'docked') return { bottom: stage.bottom - r.top + 8 };
      if (placement === 'right') return { right: stage.right - r.left + 12 };
      return { left: r.right - stage.left + 12 };
    },
    focus(to) {
      returnTo = to ?? (document.activeElement as HTMLElement | null);
      closeBtn.focus({ preventScroll: true });
    },
    onClose(fn) {
      closeListeners.add(fn);
      return () => {
        closeListeners.delete(fn);
      };
    },
    dispose() {
      offTick();
      offStore();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      body.removeEventListener('scroll', fit);
      closeListeners.clear();
    },
  };
  return api;
}
