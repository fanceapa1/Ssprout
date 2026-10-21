import type { UIContext } from './context';
import type { PlanBlockLike } from './plan-line';

/**
 * Everything the timer panel shows about the running session, read from `controller.status()`
 * in one place (so the panel never re-derives session maths).
 */
export interface SessionView {
  taskName: string;
  speciesId: string;
  plantName: string;
  blocks: PlanBlockLike[];
  blockIndex: number;
  block: PlanBlockLike;
  blockRemainingMs: number;
  totalRemainingMs: number;
  totalMinutes: number;
  /** 1-based index of the current (or upcoming) focus block, and how many there are */
  focusIndex: number;
  focusCount: number;
  /** the current break has been watered */
  watered: boolean;
  /** indices of watered break blocks */
  wateredBlocks: number[];
  paused: boolean;
  longPause: boolean;
  growth: number;
}

export function sessionView(ctx: UIContext): SessionView | null {
  const st = ctx.deps.controller.status();
  const s = st.session;
  const t = st.timeline;
  if (!s || !t) return null;
  const blocks = s.plan.blocks;
  const focusBefore = blocks.slice(0, t.blockIndex + 1).filter((b) => b.kind === 'focus').length;
  const def = ctx.deps.getSpecies(s.speciesId);
  return {
    taskName: s.taskName,
    speciesId: s.speciesId,
    plantName: def?.name ?? 'seedling',
    blocks,
    blockIndex: t.blockIndex,
    block: t.block,
    blockRemainingMs: t.blockRemainingMs,
    totalRemainingMs: t.totalRemainingMs,
    totalMinutes: blocks.reduce((sum, b) => sum + b.minutes, 0),
    focusIndex: Math.max(1, t.block.kind === 'focus' ? focusBefore : focusBefore + 1),
    focusCount: blocks.filter((b) => b.kind === 'focus').length,
    watered: t.watered,
    wateredBlocks: s.waterings,
    paused: st.phase === 'paused',
    longPause: st.longPause,
    growth: t.growth,
  };
}
