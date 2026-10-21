import type { SessionStatus } from '../core/controller';
import { formatClock } from '../core/session';

/** What the floating widget card shows, derived purely from the controller status. */

export type WidgetMode = 'idle' | 'running' | 'paused' | 'complete';
export type WidgetActionKind = 'pause' | 'resume' | 'open';

export interface WidgetView {
  mode: WidgetMode;
  /** remaining time (`24:13`), `0:00` when complete, empty when idle */
  time: string;
  /** one quiet line under the time */
  state: string;
  /** sprout growth 0..1 (the session progress) */
  growth: number;
  /** the bud opens */
  bloom: boolean;
  action: { kind: WidgetActionKind; label: string };
  /** seeds the sprout's shape: stable for one session */
  seed: string;
}

export const STATE_TEXT = {
  idle: 'No session running',
  running: 'growing quietly',
  paused: 'paused',
  complete: 'complete — return to your garden',
} as const satisfies Record<WidgetMode, string>;

export const ACTION_LABEL = { pause: 'Pause', resume: 'Resume', open: 'Open garden' } as const satisfies Record<
  WidgetActionKind,
  string
>;

const action = (kind: WidgetActionKind) => ({ kind, label: ACTION_LABEL[kind] });

export function widgetView(st: Pick<SessionStatus, 'phase' | 'remainingMs' | 'progress' | 'session' | 'pendingReward'>): WidgetView {
  const progress = Number.isFinite(st.progress) ? Math.max(0, Math.min(1, st.progress)) : 0;
  switch (st.phase) {
    case 'running':
      return {
        mode: 'running',
        time: formatClock(st.remainingMs),
        state: STATE_TEXT.running,
        growth: progress,
        bloom: false,
        action: action('pause'),
        seed: st.session?.id ?? 'session',
      };
    case 'paused':
      return {
        mode: 'paused',
        time: formatClock(st.remainingMs),
        state: STATE_TEXT.paused,
        growth: progress,
        bloom: false,
        action: action('resume'),
        seed: st.session?.id ?? 'session',
      };
    case 'reward':
      return {
        mode: 'complete',
        time: '0:00',
        state: STATE_TEXT.complete,
        growth: 1,
        bloom: true,
        action: action('open'),
        seed: st.pendingReward?.sessionId ?? 'session',
      };
    default:
      return { mode: 'idle', time: '', state: STATE_TEXT.idle, growth: 0, bloom: false, action: action('open'), seed: 'idle' };
  }
}
