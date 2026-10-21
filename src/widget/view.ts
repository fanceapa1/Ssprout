import { formatClock } from '../core/session';
import type { BlockKind, WidgetPlanBlock, WidgetSession, WidgetStatus } from './contract';

/** What the floating widget card shows, derived purely from the controller status. */

export type WidgetMode = 'idle' | 'focus' | 'break' | 'paused' | 'complete';
export type WidgetActionKind = 'pause' | 'resume' | 'water' | 'skip' | 'open';

export interface WidgetButton {
  kind: WidgetActionKind;
  label: string;
  /** the vermilion-seal action */
  primary: boolean;
}

/** One block of the plan as a fraction of the whole session (for the progress line). */
export interface PlanSegment {
  kind: BlockKind;
  start: number;
  end: number;
}

export interface WidgetView {
  mode: WidgetMode;
  /** the task the plant stands for ('' when idle) */
  task: string;
  /** big numerals: time left in the current block ('' when idle / complete) */
  time: string;
  /** small line: time left in the whole session, only when the plan has breaks */
  total: string;
  /** one quiet line */
  state: string;
  /** plant growth 0..1 (focused time ÷ total focus) */
  growth: number;
  /** whole-session progress 0..1 */
  progress: number;
  segments: PlanSegment[];
  buttons: WidgetButton[];
  speciesId: string | null;
  seed: number;
}

export const IDLE_TEXT = 'No session running';
export const PAUSED_TEXT = 'paused';

export const LABEL: Record<WidgetActionKind, string> = {
  pause: 'Pause',
  resume: 'Resume',
  water: 'Water',
  skip: 'Skip break',
  open: 'Open garden',
};

const button = (kind: WidgetActionKind, primary = false): WidgetButton => ({ kind, label: LABEL[kind], primary });

export const breakText = (plant: string, watered: boolean): string =>
  watered ? `Watered — your ${plant} is resting` : `Break — your ${plant} is thirsty`;
export const completeText = (plant: string): string => `Your ${plant} has bloomed — return to your garden`;

export function planSegments(blocks: readonly WidgetPlanBlock[]): PlanSegment[] {
  const total = blocks.reduce((n, b) => n + Math.max(0, b.minutes), 0);
  if (total <= 0) return [];
  let at = 0;
  return blocks.map((b) => {
    const start = at / total;
    at += Math.max(0, b.minutes);
    return { kind: b.kind, start, end: at / total };
  });
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export interface WidgetViewOptions {
  /** the session that just completed (shown in bloom until a new one starts) */
  completed?: WidgetSession | null;
  /** display name of a species (default: "plant") */
  speciesName?: (id: string) => string | undefined;
}

export function widgetView(st: WidgetStatus, opts: WidgetViewOptions = {}): WidgetView {
  const name = (id: string) => opts.speciesName?.(id) ?? 'plant';
  const s = st.session;
  const tl = st.timeline;
  if (st.phase === 'idle' || !s || !tl) {
    const done = st.phase === 'idle' ? opts.completed : null;
    if (done) {
      return {
        mode: 'complete',
        task: done.taskName,
        time: '',
        total: '',
        state: completeText(name(done.speciesId)),
        growth: 1,
        progress: 1,
        segments: planSegments(done.plan.blocks),
        buttons: [button('open', true)],
        speciesId: done.speciesId,
        seed: done.seed,
      };
    }
    return {
      mode: 'idle',
      task: '',
      time: '',
      total: '',
      state: IDLE_TEXT,
      growth: 0,
      progress: 0,
      segments: [],
      buttons: [button('open')],
      speciesId: null,
      seed: 0,
    };
  }

  const hasBreaks = s.plan.blocks.some((b) => b.kind === 'break');
  const base = {
    task: s.taskName,
    time: formatClock(tl.blockRemainingMs),
    total: hasBreaks ? `${formatClock(tl.totalRemainingMs)} in all` : '',
    growth: clamp01(tl.growth),
    progress: clamp01(tl.progress),
    segments: planSegments(s.plan.blocks),
    speciesId: s.speciesId,
    seed: s.seed,
  };
  switch (st.phase) {
    case 'break':
      return {
        ...base,
        mode: 'break',
        state: breakText(name(s.speciesId), tl.watered),
        buttons: tl.watered ? [button('skip'), button('pause')] : [button('water', true), button('skip'), button('pause')],
      };
    case 'paused':
      return { ...base, mode: 'paused', state: PAUSED_TEXT, buttons: [button('resume')] };
    default: {
      const focusBlocks = s.plan.blocks.filter((b) => b.kind === 'focus').length;
      const n = s.plan.blocks.slice(0, tl.blockIndex + 1).filter((b) => b.kind === 'focus').length;
      return {
        ...base,
        mode: 'focus',
        state: focusBlocks > 1 ? `focus ${n} of ${focusBlocks}` : 'growing quietly',
        buttons: [button('pause')],
      };
    }
  }
}
