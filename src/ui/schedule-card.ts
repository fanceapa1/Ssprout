import { findPlan } from '../core/plans';
import type { OccurrenceView } from '../core/schedule';
import type { Scheduler } from '../core/schedule-controller';
import { MAX_SESSIONS } from '../core/state';
import type { UIContext } from './context';
import { h, setText, show } from './dom';
import { formatMinutes } from './calendar-model';

/**
 * The waiting card (SPEC §13, ADR 0176): when a scheduled session's time comes, a card waits at
 * the top of the Study section with one-tap **Start** (the planting sheet, prefilled) and a quiet
 * "Not this time"; a small slip above the timer pill says the same on the garden. Nothing starts
 * on its own. At three sessions in progress the card says so gently and offers to go to them.
 */

export interface DueCardsDeps {
  scheduler: Scheduler;
  /** open the start flow prefilled from the occurrence */
  start(occurrence: OccurrenceView, opener: HTMLElement): void;
  /** show the sessions in progress (the Study section's rows and their Switch) */
  showSessions(opener: HTMLElement): void;
}

export interface DueCardsState {
  /** occurrence keys waiting for Start, oldest first */
  due: string[];
  /** what the cards offer: Start, or (at the limit) the sessions in progress */
  mode: 'start' | 'limit' | null;
  /** the slip on the garden is showing */
  slip: boolean;
}

export interface DueCards {
  /** the cards, for the Study section */
  readonly el: HTMLElement;
  /** the slip, for the garden stage */
  readonly slip: HTMLElement;
  render(): void;
  state(): DueCardsState;
}

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export const LIMIT_CARD_NOTE = `${MAX_SESSIONS === 3 ? 'Three' : String(MAX_SESSIONS)} seedlings are already growing. When one blooms or you end one, this can begin — or switch to one of them now.`;

/** "50 min · Pomodoro", "50 min · the plan chosen when you begin", "time and plan chosen when you begin". */
export function dueMeta(o: Pick<OccurrenceView, 'lengthMinutes' | 'planId'>): string {
  if (o.lengthMinutes === null) return 'Time and plan chosen when you begin';
  const plan = o.planId ? findPlan(o.lengthMinutes, o.planId)?.name : null;
  return `${formatMinutes(o.lengthMinutes)} · ${plan ?? 'the plan chosen when you begin'}`;
}

export function createDueCards(ctx: UIContext, deps: DueCardsDeps): DueCards {
  const { scheduler } = deps;
  const { controller } = ctx.deps;
  const el = h('ul.due-cards', { role: 'list', 'aria-label': 'Planned sessions waiting to start' });
  const slipText = h('span.due-slip-text');
  const slipStart = h('button.quiet.due-slip-start', { type: 'button' }, 'Start');
  const slip = h('div.due-slip', { role: 'group', 'aria-label': 'A planned session' }, slipText, slipStart);
  let current: DueCardsState = { due: [], mode: null, slip: false };
  let first: OccurrenceView | null = null;
  slipStart.addEventListener('click', () => first && deps.start(first, slipStart));

  function card(o: OccurrenceView, limit: boolean): HTMLLIElement {
    const start = h('button.seal.due-start', { type: 'button', 'aria-label': `Start “${o.name}”`, onclick: () => deps.start(o, start) }, 'Start');
    const pass = h(
      'button.quiet.due-pass',
      {
        type: 'button',
        onclick: () => {
          if (scheduler.dismiss({ scheduleId: o.scheduleId, date: o.date })) ctx.announce(`“${o.name}” will wait for another day.`);
        },
      },
      'Not this time',
    );
    const see = h('button.quiet.ink.due-see', { type: 'button', onclick: () => deps.showSessions(see) }, 'See them');
    return h(
      'li.due-card',
      { 'data-occurrence': o.key, 'data-mode': limit ? 'limit' : 'start' },
      h('p.due-when', {}, `Planned for ${fmtTime.format(o.at)}`),
      h('p.due-name', {}, o.name),
      h('p.due-meta', {}, dueMeta(o)),
      limit ? h('p.due-note', { role: 'note' }, LIMIT_CARD_NOTE) : null,
      h('div.due-actions', {}, limit ? see : start, pass),
    );
  }

  function render(): void {
    const due = scheduler.due();
    const limit = due.length > 0 && !controller.status().canStart;
    const key = due.map((o) => `${o.key}:${o.name}:${o.lengthMinutes}:${o.planId}`).join('|') + `|${limit}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.replaceChildren(...due.map((o) => card(o, limit)));
    }
    show(el, due.length > 0);
    first = due[0] ?? null;
    const slipShown = first !== null && !limit;
    show(slip, slipShown);
    if (first) {
      slipText.replaceChildren(h('b', {}, first.name), due.length > 1 ? ` and ${due.length - 1} more · their time has come` : ' · its time has come');
      slipStart.setAttribute('aria-label', `Start “${first.name}”`);
    }
    const next: DueCardsState = { due: due.map((o) => o.key), mode: due.length === 0 ? null : limit ? 'limit' : 'start', slip: slipShown };
    if (next.due.join() !== current.due.join() || next.mode !== current.mode) ctx.changed();
    current = next;
  }

  setText(slipText, '');
  render();
  return { el, slip, render, state: () => current };
}
