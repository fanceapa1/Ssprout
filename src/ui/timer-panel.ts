import { MINUTE_MS } from '../core/session';
import type { UIContext } from './context';
import { fragment, h, setText, show } from './dom';
import { crossedMilestone, formatTimer, inSentence, spokenMinutes } from './format';
import { ICONS } from './icons';
import { createPlanLineSvg, renderPlanLine } from './plan-line';
import { sessionView, type SessionView } from './session-view';
import type { UIState } from './types';

/**
 * The timer panel (bottom centre). Idle: "Start studying". Studying: task name, the current
 * block ("Focus · 2 of 3" / "Break — water your iris"), block and total remaining, the plan as a
 * segmented brush line with progress, Pause / End; during a break a watering can (Water) and
 * Skip break. Every action goes through the session controller.
 */
export type PanelView = UIState['panel'];

export interface TimerPanel {
  readonly el: HTMLElement;
  render(): void;
  view(): PanelView;
  confirm(): 'cancel' | null;
  resting(): boolean;
  dispose(): void;
}

export interface TimerPanelActions {
  /** open the planting sheet */
  plant(opener: HTMLElement): void;
}

const REST_AFTER_MS = 4000;
const PLAN_W = 320;

export function createTimerPanel(ctx: UIContext, actions: TimerPanelActions): TimerPanel {
  const { controller } = ctx.deps;
  let confirm: 'cancel' | null = null;
  let resting = false;
  let restTimer: ReturnType<typeof setTimeout> | null = null;
  let prevRemaining: number | null = null;
  let lastView: PanelView | null = null;

  // ── idle ────────────────────────────────────────────────────────────────────────────────
  const plantBtn = h('button.seal.plant-session', { type: 'button', 'data-anchor': 'start', onclick: () => actions.plant(plantBtn) }, 'Start studying');
  const idleLine = h('p.idle-line');
  const idle = h('div.view.view-idle', {}, h('span.idle-sprout', { 'aria-hidden': 'true' }, fragment(ICONS.sprout)), idleLine, h('div.actions', {}, plantBtn));

  // ── studying ────────────────────────────────────────────────────────────────────────────
  const taskName = h('p.task-name');
  const blockLabel = h('p.block-label');
  const time = h('p.time', { 'aria-hidden': 'true' });
  const total = h('p.total');
  const timeSr = h('span.visually-hidden.time-sr');
  const plan = createPlanLineSvg();
  plan.classList.add('panel-plan');

  const pauseBtn = h('button.quiet.pause', { type: 'button', onclick: () => controller.pause() }, 'Pause');
  const resumeBtn = h('button.seal.resume', { type: 'button', onclick: () => controller.resume() }, 'Resume');
  const endBtn = h('button.quiet.end', { type: 'button', onclick: () => openConfirm() }, 'End');
  const waterBtn = h(
    'button.water',
    { type: 'button', 'data-anchor': 'water', onclick: () => water() },
    h('span.water-icon', { 'aria-hidden': 'true' }, fragment(ICONS.wateringCan)),
    h('span.water-text', {}, 'Water'),
  );
  const skipBtn = h('button.quiet.skip-break', { type: 'button', onclick: () => controller.skipBreak() }, 'Skip break');
  const breakActions = h('div.actions.break-actions', {}, waterBtn, skipBtn);
  const sessionActions = h('div.actions', {}, pauseBtn, resumeBtn, endBtn);

  const confirmText = h('p#confirm-cancel-text');
  const keepBtn = h('button.quiet.keep', { type: 'button', onclick: () => closeConfirm() }, 'Keep studying');
  const confirmEndBtn = h('button.quiet.ink.confirm-end', { type: 'button', onclick: () => doCancel() }, 'End');
  const cancelConfirm = h('div.confirm.confirm-cancel', { role: 'group', 'aria-labelledby': 'confirm-cancel-text' }, confirmText, h('div.actions', {}, keepBtn, confirmEndBtn));

  const longResume = h('button.seal.long-resume', { type: 'button', onclick: () => controller.resume() }, 'Resume');
  const longEnd = h('button.quiet.long-end', { type: 'button', onclick: () => doCancel() }, 'End session');
  const longPause = h(
    'div.confirm.long-pause',
    { role: 'group', 'aria-labelledby': 'long-pause-text' },
    h('p#long-pause-text', {}, 'Still with us?'),
    h('p.soft', {}, 'The garden has been holding its breath for a while.'),
    h('div.actions', {}, longResume, longEnd),
  );

  const session = h('div.view.view-session', {}, taskName, blockLabel, time, total, timeSr, plan, breakActions, sessionActions, cancelConfirm, longPause);
  const el = h('section.panel.slip', { 'aria-label': 'Study timer', 'data-ui': 'panel' }, idle, session);

  // ── behaviour ───────────────────────────────────────────────────────────────────────────
  function water(): void {
    if (controller.water()) ctx.announce('Watered. It drinks it in.');
  }

  function openConfirm(): void {
    confirm = 'cancel';
    render();
    keepBtn.focus({ preventScroll: true });
  }

  function closeConfirm(): void {
    confirm = null;
    render();
    endBtn.focus({ preventScroll: true });
  }

  function doCancel(): void {
    const v = sessionView(ctx);
    confirm = null;
    if (controller.cancel()) ctx.announce(`Session ended. ${v?.plantName ?? 'The seedling'} won’t bloom this time — that’s all right.`);
    render();
    plantBtn.focus({ preventScroll: true });
  }

  const viewOf = (v: SessionView | null): PanelView => {
    if (!v) return 'idle';
    if (v.paused) return v.longPause ? 'longPause' : 'paused';
    return v.block.kind === 'break' ? 'break' : 'focus';
  };

  function render(): void {
    const v = sessionView(ctx);
    const view = viewOf(v);
    if (view !== lastView) {
      if (lastView && lastView !== 'idle') {
        if (view === 'paused') ctx.announce('Paused.');
        if ((lastView === 'paused' || lastView === 'longPause') && (view === 'focus' || view === 'break')) ctx.announce('Resumed.');
        if (view === 'longPause') ctx.announce('Still with us? The session is paused.');
        if (lastView === 'focus' && view === 'break' && v) ctx.announce(`Time for a break — your ${inSentence(v.plantName)} is thirsty.`);
        if (lastView === 'break' && view === 'focus') ctx.announce('Back to focus.');
      }
      if (view === 'idle') confirm = null;
      lastView = view;
      prevRemaining = null;
      wake();
    }
    el.dataset.view = view;
    show(idle, view === 'idle');
    show(session, view !== 'idle');

    if (!v) {
      const n = ctx.deps.store.get().plants.length;
      setText(idleLine, n === 0 ? 'Name a task, choose a plant, and watch it grow while you work.' : n === 1 ? 'One plant is growing in your garden.' : `${n} plants are growing in your garden.`);
    } else {
      setText(taskName, v.taskName);
      const plantLower = inSentence(v.plantName);
      if (view === 'break') setText(blockLabel, v.watered ? `Break — your ${plantLower} has had a drink` : `Break — water your ${plantLower}`);
      else if (view === 'focus') setText(blockLabel, v.focusCount > 1 ? `Focus · ${v.focusIndex} of ${v.focusCount}` : 'Focus');
      else setText(blockLabel, 'paused');
      setText(time, formatTimer(v.blockRemainingMs));
      setText(total, v.blocks.length > 1 ? `${formatTimer(v.totalRemainingMs)} left in all` : '');
      setText(timeSr, `${spokenMinutes(Math.ceil(v.totalRemainingMs / MINUTE_MS))} left`);
      const elapsed = v.totalMinutes - v.totalRemainingMs / MINUTE_MS;
      renderPlanLine(plan, v.blocks, PLAN_W, { elapsedMinutes: elapsed, current: v.blockIndex, watered: v.wateredBlocks });
      if (view === 'focus' && prevRemaining !== null) {
        const m = crossedMilestone(prevRemaining, v.totalRemainingMs, v.totalMinutes * MINUTE_MS);
        if (m) ctx.announce(m);
      }
      prevRemaining = v.totalRemainingMs;
      const confirming = confirm === 'cancel';
      setText(confirmText, `End this session? Your ${plantLower} won’t bloom this time.`);
      show(breakActions, view === 'break' && !confirming);
      waterBtn.disabled = v.watered;
      waterBtn.setAttribute('aria-label', v.watered ? 'Watered' : `Water your ${plantLower}`);
      setText(waterBtn.querySelector('.water-text')!, v.watered ? 'Watered' : 'Water');
      show(sessionActions, !confirming && view !== 'longPause');
      show(pauseBtn, view === 'focus' || view === 'break');
      show(resumeBtn, view === 'paused');
      show(cancelConfirm, confirming && view !== 'longPause');
      show(longPause, view === 'longPause');
    }
    applyResting();
  }

  // ── resting (fade while studying) ───────────────────────────────────────────────────────
  const canRest = () => lastView === 'focus' && confirm === null;
  function applyResting(): void {
    ctx.deps.root.classList.toggle('is-resting', resting && canRest());
  }

  function wake(): void {
    if (restTimer !== null) clearTimeout(restTimer);
    restTimer = null;
    if (resting) {
      resting = false;
      applyResting();
      ctx.changed();
    }
    if (lastView === 'focus') {
      restTimer = setTimeout(() => {
        restTimer = null;
        resting = true;
        applyResting();
        ctx.changed();
      }, ctx.delay(REST_AFTER_MS));
    }
  }

  const wakeEvents = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  for (const ev of wakeEvents) window.addEventListener(ev, wake, { passive: true, capture: true });
  el.addEventListener('focusin', wake);

  render();

  return {
    el,
    render,
    view: () => lastView ?? viewOf(sessionView(ctx)),
    confirm: () => confirm,
    resting: () => resting && canRest(),
    dispose() {
      if (restTimer !== null) clearTimeout(restTimer);
      for (const ev of wakeEvents) window.removeEventListener(ev, wake, { capture: true });
    },
  };
}
