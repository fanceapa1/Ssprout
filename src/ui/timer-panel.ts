import { MAX_TASK_NAME, MINUTE_MS, normalizeTaskName } from '../core/session';
import type { UIContext } from './context';
import { fragment, h, setText, show } from './dom';
import { crossedMilestone, formatTimer, inSentence, spokenMinutes } from './format';
import { ICONS, sproutMarkSvg } from './icons';
import { createPlanLineSvg, renderPlanLine } from './plan-line';
import { sessionView, type SessionView } from './session-view';
import type { UIState } from './types';

/**
 * The session controls, in the dock's "Study" section (ADR 0130; it was a slip on the painting
 * before). Idle: "Start studying". Studying: task name, the current block ("Focus · 2 of 3" /
 * "Break — water your iris"), block and total remaining, the plan as a segmented brush line with
 * progress, Pause / End; during a break a watering can (Water) and Skip break; the end question and
 * "Still with us?". Every action goes through the session controller. While focusing, the controls
 * on the painting (pill, corner icons) rest: `resting` drives the root's `is-resting` class.
 */
export type PanelView = UIState['panel'];

export interface TimerPanel extends TimerPanelExtras {
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
  /**
   * A planned session's card offers Start at the top of the section (ADR 0176): it is then the
   * one primary action, and the controls here step back (ADR 0201).
   */
  dueWaiting?(): boolean;
}

export interface TimerPanelExtras {
  /** the control a jump to the controls should focus: Water in a dry break, Resume, Pause, Start */
  focusTarget(): HTMLElement | null;
}

const REST_AFTER_MS = 4000;
const PLAN_W = 420;
let panelCount = 0;

export function createTimerPanel(ctx: UIContext, actions: TimerPanelActions): TimerPanel {
  const { controller } = ctx.deps;
  let confirm: 'cancel' | null = null;
  let resting = false;
  let restTimer: ReturnType<typeof setTimeout> | null = null;
  let prevRemaining: number | null = null;
  let lastView: PanelView | null = null;

  // ── idle ────────────────────────────────────────────────────────────────────────────────
  const plantBtn = h('button.seal.plant-session', { type: 'button', 'data-anchor': 'start', onclick: () => actions.plant(plantBtn) }, fragment(sproutMarkSvg('seal-mark')), 'Start studying');
  const idleLine = h('p.idle-line');
  const idle = h('div.view.view-idle', {}, h('span.idle-sprout', { 'aria-hidden': 'true' }, fragment(ICONS.sprout)), idleLine, h('div.actions', {}, plantBtn));

  // ── studying ────────────────────────────────────────────────────────────────────────────
  const taskName = h('p.task-name');
  const uid = `session-name-${++panelCount}`;
  let editingId: string | null = null;
  const renameBtn = h('button.quiet.session-rename', { type: 'button', onclick: () => {
    const current = controller.status().session;
    if (!current) return;
    editingId = current.id;
    nameInput.value = current.taskName;
    show(nameForm, true);
    show(renameBtn, false);
    nameInput.focus();
    nameInput.select();
    ctx.changed();
  } }, 'Rename');
  const nameInput = h('input', { id: uid, type: 'text', maxlength: MAX_TASK_NAME, autocomplete: 'off', 'aria-describedby': `${uid}-hint` });
  const nameForm = h('form.session-name-edit', { hidden: true, onsubmit: (e: Event) => {
    e.preventDefault();
    if (!editingId) return;
    const name = normalizeTaskName(nameInput.value);
    controller.rename(editingId, name);
    closeNameEdit();
    ctx.announce(`Renamed to ${name}.`);
  } },
  h('label', { for: uid }, 'Study session name'), nameInput,
  h('span.session-name-hint', { id: `${uid}-hint` }, 'Up to 40 characters. Leave blank for “Study session”.'),
  h('div.session-name-actions', {},
    h('button.quiet.ink', { type: 'submit' }, 'Save'),
    h('button.quiet', { type: 'button', onclick: () => closeNameEdit() }, 'Cancel'),
  ));
  nameForm.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    closeNameEdit();
  });

  function closeNameEdit(restoreFocus = true): void {
    editingId = null;
    show(nameForm, false);
    show(renameBtn, true);
    if (restoreFocus) renameBtn.focus();
    ctx.changed();
  }
  const blockLabel = h('p.block-label');
  const time = h('p.time', { 'aria-hidden': 'true' });
  const total = h('p.total');
  const timeSr = h('span.visually-hidden.time-sr');
  const plan = createPlanLineSvg();
  plan.classList.add('panel-plan');

  const pauseBtn = h('button.quiet.pause', { type: 'button', onclick: () => controller.pause() }, h('span.pause-mark', { 'aria-hidden': 'true' }, fragment(ICONS.pause)), 'Pause');
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
  // Escape steps back out of the question, like closing a dialog
  cancelConfirm.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirm === 'cancel') {
      e.preventDefault();
      closeConfirm();
    }
  });

  const longResume = h('button.seal.long-resume', { type: 'button', onclick: () => controller.resume() }, 'Resume');
  const longEnd = h('button.quiet.long-end', { type: 'button', onclick: () => doCancel() }, 'End session');
  const longPause = h(
    'div.confirm.long-pause',
    { role: 'group', 'aria-labelledby': 'long-pause-text' },
    h('p#long-pause-text', {}, 'Still with us?'),
    h('p.soft', {}, 'The garden has been holding its breath for a while.'),
    h('div.actions', {}, longResume, longEnd),
  );

  const session = h('div.view.view-session', {}, h('div.session-name-heading', {}, taskName, renameBtn), nameForm, blockLabel, time, total, timeSr, plan, breakActions, sessionActions, cancelConfirm, longPause);
  const el = h('div.panel', { 'data-panel': '' }, idle, session);

  // ── behaviour ───────────────────────────────────────────────────────────────────────────
  const leads = [plantBtn, pauseBtn, resumeBtn, waterBtn, skipBtn, longResume];
  /** controls drawn as a vermilion seal while they lead, and as an ink slip when they step back */
  const sealLeads: HTMLElement[] = [plantBtn, resumeBtn, longResume];
  /**
   * `data-primary` on the one control that is the next step (tests and styles read it). The look
   * follows the mark (ADR 0201): a seal-style control is a seal only while it is the primary, so a
   * due card's Start never sits beside a second seal.
   */
  function markPrimary(lead: HTMLElement | null): void {
    for (const b of leads) {
      if (b === lead) b.dataset.primary = 'true';
      else delete b.dataset.primary;
    }
    for (const b of sealLeads) {
      const primary = b === lead;
      b.classList.toggle('seal', primary);
      b.classList.toggle('quiet', !primary);
      b.classList.toggle('ink', !primary);
    }
  }

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
    if (editingId && editingId !== controller.status().session?.id) closeNameEdit(false);
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

    // one primary action at a time (ADR 0201): a planned session's Start wins, then the panel's own
    const due = actions.dueWaiting?.() ?? false;
    if (!v) {
      const n = ctx.deps.store.get().plants.length;
      const waiting = controller.status().sessions;
      // others wait (after a bloom): the list below offers Resume, so starting anew steps back
      const primary = waiting.length === 0 && !due;
      markPrimary(primary ? plantBtn : null);
      setText(
        idleLine,
        waiting.length === 1
          ? `“${waiting[0]!.session.taskName}” is waiting for you.`
          : waiting.length > 1
            ? `${waiting.length === 2 ? 'Two' : 'Three'} sessions are waiting for you.`
            : n === 0
              ? 'Your garden is ready for its first plant.'
              : n === 1
                ? 'One plant is growing in your garden.'
                : `${n} plants are growing in your garden.`,
      );
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
      // the next step is the primary: Pause while focusing, Water in a break (then Skip break),
      // Resume when paused; the rest recede (quiet ink)
      const lead =
        confirming || due
          ? null
          : view === 'focus'
            ? pauseBtn
            : view === 'break'
              ? v.watered
                ? skipBtn
                : waterBtn
              : view === 'paused'
                ? resumeBtn
                : view === 'longPause'
                  ? longResume
                  : null;
      pauseBtn.className = `${lead === pauseBtn ? 'calm' : 'quiet'} pause`;
      skipBtn.className = `${lead === skipBtn ? 'calm' : 'quiet'} skip-break`;
      waterBtn.classList.toggle('is-lead', lead === waterBtn);
      markPrimary(lead);
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
    focusTarget() {
      const view = lastView ?? 'idle';
      if (view === 'idle') return plantBtn;
      if (view === 'longPause') return longResume;
      if (confirm === 'cancel') return keepBtn;
      if (view === 'break' && !waterBtn.disabled) return waterBtn;
      if (view === 'paused') return resumeBtn;
      return pauseBtn;
    },
    confirm: () => confirm,
    resting: () => resting && canRest(),
    dispose() {
      if (restTimer !== null) clearTimeout(restTimer);
      for (const ev of wakeEvents) window.removeEventListener(ev, wake, { capture: true });
    },
  };
}
