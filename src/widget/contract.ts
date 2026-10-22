import type { Ticker } from '../core/controller';
import type { Settings } from '../core/state';

/**
 * The slice of the session controller the widget uses, typed structurally so the widget does
 * not depend on every detail of `core/controller.ts`. It follows the session-plan API from
 * ADR 0003 (phases focus / break / paused, a `timeline`, `water()`, `skipBreak()`); the real
 * controller satisfies it. Keep it minimal.
 */

export type WidgetPhase = 'idle' | 'focus' | 'break' | 'paused';
export type BlockKind = 'focus' | 'break';

export interface WidgetPlanBlock {
  kind: BlockKind;
  minutes: number;
}

export interface WidgetTimeline {
  blockIndex: number;
  block: WidgetPlanBlock;
  blockRemainingMs: number;
  totalRemainingMs: number;
  /** focused ms ÷ total focus ms, 0..1 */
  growth: number;
  /** elapsed ÷ total session time, 0..1 */
  progress: number;
  /** the current break has been watered */
  watered: boolean;
  complete: boolean;
}

export interface WidgetSession {
  id: string;
  taskName: string;
  plan: { id: string; name: string; blocks: readonly WidgetPlanBlock[] };
  speciesId: string;
  seed: number;
}

/** A session in progress, as the widget lists it (ADR 0150). */
export interface WidgetSessionSummary {
  session: Pick<WidgetSession, 'id' | 'taskName'>;
  /** the session the card follows */
  active: boolean;
  /** the waiting session left most recently */
  lastLeft?: boolean;
}

export interface WidgetStatus {
  phase: WidgetPhase;
  timeline: WidgetTimeline | null;
  /** the active session */
  session: WidgetSession | null;
  /** every session in progress, oldest start first (absent: only `session`) */
  sessions?: readonly WidgetSessionSummary[];
}

export interface WidgetController {
  status(): WidgetStatus;
  onTick(fn: () => void): () => void;
  pause(): unknown;
  resume(): unknown;
  water(): unknown;
  skipBreak(): unknown;
  /** make another session in progress the active one (optional: without it the card offers no switch) */
  switchTo?(id: string): unknown;
  setTicker(ticker: Ticker): void;
  updateSettings(patch: Partial<Settings>): unknown;
}

/** Event names the widget listens to (payloads are read defensively). */
export type WidgetEvent =
  | 'session:start'
  | 'session:break'
  | 'session:focus'
  | 'session:water'
  | 'session:complete'
  | 'session:cancel'
  | 'session:switch';

/** A bus as the widget uses it. The app's EventBus satisfies it (see `looseBus`). */
export interface WidgetBus {
  on(name: WidgetEvent, fn: (payload: unknown) => void): () => void;
}

/**
 * View any typed event bus as a WidgetBus. The app bus is typed per event name; the widget only
 * needs `on` and reads payloads defensively, so this cast is safe.
 */
export const looseBus = (bus: unknown): WidgetBus => bus as WidgetBus;

/** `sessionId` of an event payload, when it has one. */
export function payloadSessionId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as { sessionId?: unknown; session?: { id?: unknown }; plant?: { sessionId?: unknown } };
  if (typeof p.sessionId === 'string') return p.sessionId;
  if (typeof p.session?.id === 'string') return p.session.id;
  return null;
}
