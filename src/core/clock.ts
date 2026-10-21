/**
 * The only source of wall-clock time in the app. Everything that needs "now" receives a Clock,
 * so tests and the dev speed-up (`?dev&speed=N`) can control time.
 */
export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export const realClock: Clock = {
  now: () => Date.now(),
};

export interface SpeedClock extends Clock {
  readonly speed: number;
  /** Change the speed without a jump: time continues from the current virtual instant. */
  setSpeed(speed: number): void;
  /** Jump virtual time forward by `ms` (dev/test only, e.g. "complete this session now"). */
  advance(ms: number): void;
}

function assertSpeed(speed: number): void {
  if (!Number.isFinite(speed) || speed < 0) {
    throw new RangeError(`clock speed must be a finite number >= 0, got ${speed}`);
  }
}

/**
 * Accelerated clock anchored at creation: at creation it reads the same as `base`, then
 * advances `speed` times faster. `speed = 0` stops time.
 */
export function createSpeedClock(speed: number, base: Clock = realClock): SpeedClock {
  assertSpeed(speed);
  let s = speed;
  let anchorBase = base.now();
  let anchorVirtual = anchorBase;

  const now = (): number => anchorVirtual + (base.now() - anchorBase) * s;

  return {
    now,
    get speed() {
      return s;
    },
    setSpeed(next: number) {
      assertSpeed(next);
      anchorVirtual = now();
      anchorBase = base.now();
      s = next;
    },
    advance(ms: number) {
      if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`advance needs a finite ms >= 0, got ${ms}`);
      anchorVirtual += ms;
    },
  };
}

export interface ManualClock extends Clock {
  set(t: number): void;
  advance(ms: number): void;
}

/** A clock that only moves when told to. For tests. */
export function createManualClock(start = 0): ManualClock {
  let t = start;
  return {
    now: () => t,
    set(next: number) {
      t = next;
    },
    advance(ms: number) {
      t += ms;
    },
  };
}
