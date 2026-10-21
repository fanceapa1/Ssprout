import type { SessionStatus } from '../core/controller';
import { formatClock } from '../core/session';

/** Tab-title countdown (SPEC §6 fallback surface). Pure. */

export const APP_TITLE = 'Study Sprout';
export const TITLE_SEPARATOR = ' · ';

/**
 * `24:13 · Study Sprout` while running, `Paused · Study Sprout`, `Ready to bloom · Study Sprout`
 * while a reward waits, and the plain title when idle.
 */
export function titleFor(status: Pick<SessionStatus, 'phase' | 'remainingMs'>, base: string = APP_TITLE): string {
  switch (status.phase) {
    case 'running':
      return `${formatClock(status.remainingMs)}${TITLE_SEPARATOR}${base}`;
    case 'paused':
      return `Paused${TITLE_SEPARATOR}${base}`;
    case 'reward':
      return `Ready to bloom${TITLE_SEPARATOR}${base}`;
    default:
      return base;
  }
}
