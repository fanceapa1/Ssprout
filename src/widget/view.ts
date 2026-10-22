import { formatClock } from '../core/session';
import type { BlockKind, WidgetPlanBlock, WidgetSession, WidgetStatus } from './contract';

/** What the floating widget card shows, derived purely from the controller status. */

export type WidgetMode = 'idle' | 'focus' | 'break' | 'paused' | 'complete';
export type WidgetActionKind = 'pause' | 'resume' | 'water' | 'skip' | 'open' | 'switch';

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
  /** the session the 'switch' button makes active (ADR 0157), or null */
  switchTo: string | null;
}

export const IDLE_TEXT = 'No session running';
export const PAUSED_TEXT = 'paused';

export const LABEL: Record<WidgetActionKind, string> = {
  pause: 'Pause',
  resume: 'Resume',
  water: 'Water',
  skip: 'Skip break',
  open: 'Open garden',
  switch: 'Switch',
};

const button = (kind: WidgetActionKind, primary = false, label = LABEL[kind]): WidgetButton => ({ kind, label, primary });

/** "“Essay” is waiting" / "2 sessions are waiting" — the idle card's line when others wait. */
export const waitingText = (tasks: readonly string[]): string =>
  tasks.length === 1 ? `“${tasks[0]}” is waiting` : `${tasks.length} sessions are waiting`;

/**
 * Which session the card's switch goes to: with one active, the next one in progress after it
 * (cycling through all of them in start order); with none active, the one left last.
 */
export function switchTarget(st: WidgetStatus): string | null {
  const list = st.sessions ?? [];
  if (list.length === 0) return null;
  const i = list.findIndex((x) => x.active);
  if (i < 0) return (list.find((x) => x.lastLeft) ?? list[list.length - 1]!).session.id;
  return list.length > 1 ? list[(i + 1) % list.length]!.session.id : null;
}

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
  /** the controller can switch sessions (default true) */
  canSwitch?: boolean;
}

export function widgetView(st: WidgetStatus, opts: WidgetViewOptions = {}): WidgetView {
  const name = (id: string) => opts.speciesName?.(id) ?? 'plant';
  const s = st.session;
  const tl = st.timeline;
  const target = opts.canSwitch === false ? null : switchTarget(st);
  if (st.phase === 'idle' || !s || !tl) {
    const done = st.phase === 'idle' ? opts.completed : null;
    // others wait (none active): offer to resume the one left last, never on its own (ADR 0152)
    const resume = target ? [button('switch', !done, 'Resume')] : [];
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
        buttons: [button('open', true), ...resume],
        speciesId: done.speciesId,
        seed: done.seed,
        switchTo: target,
      };
    }
    const waiting = (st.sessions ?? []).map((x) => x.session.taskName);
    return {
      mode: 'idle',
      task: '',
      time: '',
      total: '',
      state: waiting.length > 0 ? waitingText(waiting) : IDLE_TEXT,
      growth: 0,
      progress: 0,
      segments: [],
      buttons: [...resume, button('open')],
      speciesId: null,
      seed: 0,
      switchTo: target,
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
    switchTo: target,
  };
  const sw = target ? [button('switch')] : [];
  switch (st.phase) {
    case 'break':
      return {
        ...base,
        mode: 'break',
        state: breakText(name(s.speciesId), tl.watered),
        buttons: tl.watered ? [button('skip'), button('pause')] : [button('water', true), button('skip'), button('pause')],
      };
    case 'paused':
      return { ...base, mode: 'paused', state: PAUSED_TEXT, buttons: [button('resume'), ...sw] };
    default: {
      const focusBlocks = s.plan.blocks.filter((b) => b.kind === 'focus').length;
      const n = s.plan.blocks.slice(0, tl.blockIndex + 1).filter((b) => b.kind === 'focus').length;
      return {
        ...base,
        mode: 'focus',
        state: focusBlocks > 1 ? `focus ${n} of ${focusBlocks}` : 'growing quietly',
        buttons: [button('pause'), ...sw],
      };
    }
  }
}
