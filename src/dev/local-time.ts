/**
 * Local time-of-day jumps for the forward-only dev clock (`sprout.advanceTo`, `schedule.demo`).
 * Tests that depend on the hour pin it with these instead of running at whatever the wall clock
 * says (docs/TESTING.md › Conventions).
 */

/** Parse `HH:MM` (24-hour, local) into minutes after midnight; throws on anything else. */
export function parseLocalTime(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  const h = m ? Number(m[1]) : NaN;
  const min = m ? Number(m[2]) : NaN;
  if (!(h >= 0 && h <= 23 && min >= 0 && min <= 59)) throw new RangeError(`expected a local time "HH:MM", got "${hhmm}"`);
  return h * 60 + min;
}

/**
 * Milliseconds from `now` to the next local `HH:MM`: later today when that is still ahead (or is
 * now), else tomorrow. Always in [0, 24 h], so the clock never has to move backwards.
 */
export function msUntilLocalTime(now: number, hhmm: string): number {
  const minutes = parseLocalTime(hhmm);
  const d = new Date(now);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();
  if (today >= now) return today - now;
  // tomorrow at that time, built from the date so a daylight-saving change lands on the same wall time
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, Math.floor(minutes / 60), minutes % 60).getTime() - now;
}
