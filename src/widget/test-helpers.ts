import type { SessionStatus } from '../core/controller';

/** A SessionStatus for tests (defaults: idle). */
export function status(patch: Partial<SessionStatus> = {}): SessionStatus {
  return {
    phase: 'idle',
    session: null,
    pendingReward: null,
    goalMs: 0,
    elapsedMs: 0,
    remainingMs: 0,
    progress: 0,
    pausedForMs: 0,
    longPause: false,
    ...patch,
  };
}

export type RecordingContext = CanvasRenderingContext2D & { fills: string[]; strokes: string[]; calls: number };

/**
 * A stand-in 2D context that records the fill/stroke styles used and accepts every call.
 * Enough to exercise drawing code under Node without a canvas implementation.
 */
export function recordingContext(): RecordingContext {
  const fills: string[] = [];
  const strokes: string[] = [];
  let calls = 0;
  const props: Record<string, unknown> = {};
  const target = {
    fills,
    strokes,
    get calls() {
      return calls;
    },
  };
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return (t as Record<string | symbol, unknown>)[key];
      if (key === 'fill') return () => fills.push(String(props.fillStyle));
      if (key === 'stroke') return () => strokes.push(String(props.strokeStyle));
      if (key === 'createRadialGradient' || key === 'createLinearGradient' || key === 'createPattern') {
        return () => ({ addColorStop() {} });
      }
      if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
      if (typeof key === 'string' && key in props) return props[key];
      return () => {
        calls++;
      };
    },
    set(_t, key, value) {
      props[String(key)] = value;
      return true;
    },
  }) as unknown as RecordingContext;
}
