import type { SessionSummary } from '../core/controller';
import { renderPlantView } from '../plants/view';
import type { UIContext } from './context';
import { fragment, h, setText, show } from './dom';
import { sproutMarkSvg } from './icons';
import { formatTimer, inSentence } from './format';
import { createPlanLineSvg, renderPlanLine } from './plan-line';
import { paintRoundWindow } from './plant-section';
import { renderPlantPreview } from './previews';

/**
 * The sessions in progress, in the dock's Study section under the controls (ADR 0156). With two or
 * three in progress — or any waiting while none is active — each gets a row: a tiny live painting
 * of its plant, the task, a thin plan line with its progress, the time left, and **Switch** (or
 * **Resume** when nothing is active; the one left last carries the seal, ADR 0152). The active row
 * says "growing now". Below, a quiet "Plant another" while a session is active; at three in
 * progress it explains gently instead of opening the sheet, and offers the rows' Switch.
 * Everything goes through the controller (`switchTo`).
 */

export interface SessionRowState {
  id: string;
  taskName: string;
  active: boolean;
  running: boolean;
  /** the row's button: switch (another is active), resume (none is), or none (the active row) */
  action: 'switch' | 'resume' | null;
  /** the suggested one (seal) */
  suggested: boolean;
  totalRemainingMs: number;
  growth: number;
}

export interface SessionListState {
  visible: boolean;
  rows: SessionRowState[];
  /** the "up to three" note is showing */
  limit: boolean;
}

export interface SessionList {
  readonly el: HTMLElement;
  render(): void;
  /** a start was refused at the limit: explain, and offer the rows' Switch (focus the first) */
  showLimit(): void;
  /** the control a jump to the controls should focus when nothing is active (Resume), else null */
  focusTarget(): HTMLElement | null;
  state(): SessionListState;
}

export interface SessionListActions {
  /** open the planting sheet for another session */
  plantAnother(opener: HTMLElement): void;
  /** a planned session's card offers Start: it is the one primary action (ADR 0201) */
  dueWaiting?(): boolean;
}

export const LIMIT_NOTE = (max: number) =>
  `${max === 3 ? 'Three' : String(max)} seedlings are growing — as many as can grow at once. Switch to one of them, or let one bloom first.`;

const BY_NAME = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * The rows' order: by start, oldest first, so a row never moves when the gardener switches.
 * Sessions started in the same instant (several started at once from the dev tools, on a frozen
 * clock) used to fall back to their ids, whose tail is random, so the same setup listed "Task 1,
 * Task 3, Task 2" in one run and "Task 1, Task 2, Task 3" in another; they now fall back to the
 * task name (numbers in order), then the id. Pure, exported for tests.
 */
export function compareSessionRows(
  a: { startedAt: number; taskName: string; id: string },
  b: { startedAt: number; taskName: string; id: string },
): number {
  return a.startedAt - b.startedAt || BY_NAME.compare(a.taskName, b.taskName) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const THUMB = 64;
const MAX_DPR = 2;
const PLAN_W = 180;

interface Row {
  li: HTMLLIElement;
  canvas: HTMLCanvasElement;
  backdrop: HTMLCanvasElement;
  task: HTMLElement;
  plan: SVGSVGElement;
  meta: HTMLElement;
  now: HTMLElement;
  button: HTMLButtonElement;
  paintKey: string;
}

export function createSessionList(ctx: UIContext, actions: SessionListActions): SessionList {
  const { controller, getSpecies } = ctx.deps;
  const title = h('h3.session-list-title');
  const list = h('ul.session-rows', { role: 'list' });
  const another = h(
    'button.quiet.plant-another',
    { type: 'button', onclick: () => plantAnother() },
    fragment(sproutMarkSvg('plant-another-mark')),
    'Plant another',
  );
  const note = h('p.limit-note', { role: 'note' });
  note.hidden = true;
  const footer = h('div.session-list-foot', {}, another, note);
  const el = h('div.session-list', { 'aria-label': 'Sessions in progress', role: 'group' }, title, list, footer);
  const rows = new Map<string, Row>();
  let current: SessionListState = { visible: false, rows: [], limit: false };
  let limit = false;

  function plantAnother(): void {
    if (!controller.status().canStart) {
      showLimit();
      return;
    }
    actions.plantAnother(another);
  }

  function showLimit(): void {
    limit = true;
    render();
    ctx.announce(note.textContent ?? '');
    const first = list.querySelector<HTMLButtonElement>('button.session-switch:not([hidden])');
    first?.focus({ preventScroll: true });
    ctx.changed();
  }

  function rowFor(id: string): Row {
    let r = rows.get(id);
    if (r) return r;
    const canvas = h('canvas.session-thumb', { role: 'img', width: THUMB, height: THUMB });
    // a small round window behind the plant, like Your plant's (ADR 0134), so a seedling has a place
    const backdrop = h('canvas.session-thumb-window', { 'aria-hidden': 'true', width: THUMB, height: THUMB });
    const frame = h('span.session-thumb-frame', {}, backdrop, canvas);
    const task = h('p.session-row-task');
    const plan = createPlanLineSvg();
    plan.classList.add('session-row-plan');
    const meta = h('p.session-row-meta');
    const now = h('span.session-row-now', {}, fragment(sproutMarkSvg('now-mark')), 'growing now');
    const button = h('button.session-switch', { type: 'button', onclick: () => choose(id) });
    const li = h('li.session-row', { dataset: { sessionId: id } }, frame, h('div.session-row-text', {}, task, plan, meta), h('div.session-row-act', {}, now, button));
    r = { li, canvas, backdrop, task, plan, meta, now, button, paintKey: '' };
    rows.set(id, r);
    return r;
  }

  function choose(id: string): void {
    const st = controller.status();
    const target = st.sessions.find((x) => x.session.id === id);
    if (!target || !controller.switchTo(id)) return;
    limit = false;
    ctx.announce(`Now growing: ${target.session.taskName}.`);
    render();
  }

  function paintThumb(r: Row, x: SessionSummary): void {
    const dpr = Math.min(MAX_DPR, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const px = Math.round(THUMB * dpr);
    if (r.canvas.width !== px || r.paintKey === '') {
      r.canvas.width = px;
      r.canvas.height = px;
      r.backdrop.width = px;
      r.backdrop.height = px;
      paintRoundWindow(r.backdrop, 2);
      r.paintKey = '';
    }
    // repaint only when the growth moves visibly (the active one grows, the waiting ones hold)
    const g = Math.round(x.timeline.growth * 200) / 200;
    const key = `${x.session.speciesId}|${x.session.seed}|${g}|${px}`;
    if (key === r.paintKey) return;
    r.paintKey = key;
    const ok = renderPlantView(r.canvas, { speciesId: x.session.speciesId, seed: x.session.seed, growth: g, watering: null, framing: 'growth' });
    if (!ok) {
      const def = getSpecies(x.session.speciesId);
      if (def) renderPlantPreview(r.canvas, def, x.session.seed, g);
    }
  }

  function render(): void {
    const st = controller.status();
    const sessions = [...st.sessions].sort((a, b) => compareSessionRows(a.session, b.session));
    const anyActive = st.session !== null;
    const visible = sessions.length >= 2 || (sessions.length >= 1 && !anyActive);
    if (st.canStart) limit = false;
    show(el, visible || anyActive);
    show(title, visible);
    show(list, visible);
    // the rows take the Study section's second track on wide screens (ADR 0200)
    el.dataset.rows = String(visible);
    el.dataset.state = anyActive ? 'active' : 'waiting';
    setText(title, anyActive ? 'Growing now' : 'Waiting for you');
    show(another, anyActive);
    note.textContent = LIMIT_NOTE(st.maxSessions);
    show(note, limit && !st.canStart);

    const seen = new Set<string>();
    const out: SessionRowState[] = [];
    sessions.forEach((x, i) => {
      const id = x.session.id;
      seen.add(id);
      const r = rowFor(id);
      if (list.children[i] !== r.li) list.insertBefore(r.li, list.children[i] ?? null);
      const def = getSpecies(x.session.speciesId);
      const plant = def?.name ?? 'seedling';
      const action: SessionRowState['action'] = x.active ? null : anyActive ? 'switch' : 'resume';
      const suggested = action === 'resume' && x.lastLeft && !(actions.dueWaiting?.() ?? false);
      r.li.dataset.active = String(x.active);
      r.li.dataset.running = String(x.running);
      setText(r.task, x.session.taskName);
      renderPlanLine(r.plan, x.session.plan.blocks, PLAN_W, {
        elapsedMinutes: x.timeline.elapsedMs / 60_000,
        current: x.timeline.blockIndex,
        watered: x.session.waterings,
      });
      const state = x.active ? (x.running ? '' : ' · paused') : ' · waiting';
      setText(r.meta, `${formatTimer(x.timeline.totalRemainingMs)} left${state}`);
      show(r.now, x.active && x.running);
      show(r.button, action !== null);
      r.button.className = `session-switch ${suggested ? 'seal' : 'quiet'}`;
      if (suggested) r.button.dataset.primary = 'true';
      else delete r.button.dataset.primary;
      if (action === 'switch') r.button.dataset.anchor = 'switch';
      else delete r.button.dataset.anchor;
      setText(r.button, action === 'resume' ? 'Resume' : 'Switch');
      r.button.setAttribute('aria-label', `${action === 'resume' ? 'Resume' : 'Switch to'} “${x.session.taskName}”`);
      r.canvas.setAttribute('aria-label', `Your ${inSentence(plant)} for “${x.session.taskName}”, ${Math.round(x.timeline.growth * 100)} percent grown`);
      if (visible) paintThumb(r, x);
      out.push({ id, taskName: x.session.taskName, active: x.active, running: x.running, action, suggested, totalRemainingMs: x.timeline.totalRemainingMs, growth: x.timeline.growth });
    });
    for (const [id, r] of rows) {
      if (seen.has(id)) continue;
      r.li.remove();
      rows.delete(id);
    }
    current = { visible, rows: out, limit: !note.hidden };
  }

  render();
  return {
    el,
    render,
    showLimit,
    focusTarget() {
      if (controller.status().session) return null;
      return list.querySelector<HTMLButtonElement>('button.session-switch.seal') ?? list.querySelector<HTMLButtonElement>('button.session-switch:not([hidden])');
    },
    state: () => current,
  };
}
