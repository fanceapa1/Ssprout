import { formatClock } from '../core/session';
import type { WidgetPhase, WidgetTimeline } from './contract';

/** Tab-title countdown (SPEC §6 fallback surface). Pure. */

export const APP_TITLE = 'Study Sprout';
export const TITLE_SEPARATOR = ' · ';

export interface TitleInput {
  phase: WidgetPhase;
  timeline: Pick<WidgetTimeline, 'blockRemainingMs'> | null;
  /** a session completed while the user was away and they have not looked yet */
  bloomed?: boolean;
}

/**
 * Focus: `24:13 · Study Sprout` (time left in the block) · break: `Break 4:12 · Study Sprout` ·
 * `Paused · Study Sprout` · `Bloomed · Study Sprout` after an unseen completion · otherwise the
 * plain title.
 */
export function titleFor(input: TitleInput, base: string = APP_TITLE): string {
  const left = formatClock(input.timeline?.blockRemainingMs ?? 0);
  switch (input.phase) {
    case 'focus':
      return `${left}${TITLE_SEPARATOR}${base}`;
    case 'break':
      return `Break ${left}${TITLE_SEPARATOR}${base}`;
    case 'paused':
      return `Paused${TITLE_SEPARATOR}${base}`;
    default:
      return input.bloomed ? `Bloomed${TITLE_SEPARATOR}${base}` : base;
  }
}
