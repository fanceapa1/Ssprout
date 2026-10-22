import type { UIContext } from './context';
import { fragment, h, setText, show } from './dom';
import { formatTimer } from './format';
import { ICONS } from './icons';
import { sessionView } from './session-view';
import type { UIState } from './types';

/**
 * The timer pill on the garden (ADR 0133): the one control that stays on the painting now that the
 * session controls live in the dock below. Idle: a small "Start studying" slip. Studying: the
 * time left in the current block, pause/resume, and a way down to the session controls (it
 * glides the page there and puts focus on the most useful control). It rests (fades) with the
 * corner icons while you focus, and steps aside while a spot is being chosen.
 */
export type PillView = UIState['pill'];

export interface Pill {
  readonly el: HTMLElement;
  render(): void;
  view(): PillView;
  /** the "+N" shown: other sessions in progress (0 = none, hidden) */
  more(): number;
  /** the pause button (keyboard focus lands here after Begin) */
  readonly pause: HTMLButtonElement;
}

export interface PillActions {
  start(opener: HTMLElement): void;
  /** go to the session controls in the dock */
  jump(): void;
}

export function createPill(ctx: UIContext, actions: PillActions): Pill {
  const { controller } = ctx.deps;
  let current: PillView = 'idle';

  const startBtn = h(
    'button.pill-start',
    { type: 'button', 'data-anchor': 'start', onclick: () => actions.start(startBtn) },
    h('span.pill-seal', { 'aria-hidden': 'true' }),
    'Start studying',
  );

  const time = h('span.pill-time', { 'aria-hidden': 'true' });
  const word = h('span.pill-word', { 'aria-hidden': 'true' });
  const timer = h('span.pill-timer', { role: 'timer', 'aria-live': 'off' }, time, word);
  const sr = h('span.visually-hidden.pill-sr');
  const pause = h('button.pill-btn.pause', { type: 'button', 'aria-label': 'Pause', onclick: () => controller.pause() }, fragment(ICONS.pause));
  const resume = h('button.pill-btn.resume', { type: 'button', 'aria-label': 'Resume', onclick: () => controller.resume() }, fragment(ICONS.play));
  const jump = h(
    'button.pill-btn.jump',
    { type: 'button', 'aria-label': 'Session controls', title: 'Session controls', onclick: () => actions.jump() },
    fragment(ICONS.down),
  );
  const session = h('div.pill-session', {}, timer, sr, pause, resume, jump);
  // other sessions in progress: a small "+2" that leads down to them (ADR 0156)
  const moreBtn = h('button.pill-more', { type: 'button', onclick: () => actions.jump() });

  const el = h('div.pill.slip', { 'data-ui': 'pill', 'data-view': 'idle', role: 'group', 'aria-label': 'Timer' }, startBtn, session, moreBtn);
  let more = 0;

  function render(): void {
    const v = sessionView(ctx);
    const view: PillView = !v ? 'idle' : v.paused ? (v.longPause ? 'longPause' : 'paused') : v.block.kind === 'break' ? 'break' : 'focus';
    current = view;
    el.dataset.view = view;
    show(startBtn, view === 'idle');
    show(session, view !== 'idle');
    const st = controller.status();
    more = st.sessions.length - (st.session ? 1 : 0);
    show(moreBtn, more > 0);
    el.dataset.more = String(more);
    if (more > 0) {
      setText(moreBtn, `+${more}`);
      const label = `${more === 1 ? 'One more session is' : `${more} more sessions are`} waiting — show them`;
      moreBtn.setAttribute('aria-label', label);
      moreBtn.title = label;
    }
    if (!v) return;
    setText(time, formatTimer(v.blockRemainingMs));
    setText(word, view === 'break' ? 'break' : view === 'focus' ? 'focus' : 'paused');
    setText(sr, `${view === 'break' ? 'Break' : view === 'focus' ? 'Focus' : 'Paused'}, ${formatTimer(v.blockRemainingMs)} left in this block`);
    show(pause, view === 'focus' || view === 'break');
    show(resume, view === 'paused' || view === 'longPause');
  }

  render();
  return {
    el,
    render,
    view: () => current,
    more: () => more,
    pause,
  };
}
