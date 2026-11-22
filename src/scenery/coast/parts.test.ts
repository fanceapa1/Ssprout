/**
 * The coast's shore, land, maquis and pine steps come in many small parts (GR2, ADR 0330): part
 * counts and the shore's recorded marks, no timing. The shore's pin is the real shore's marks (GB2,
 * devlog 224); before it, the draft shore's from before its split.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createPainter, makeCanvas } from '../../paint';
import { applyView, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { COAST_ART } from '.';
import { coastSteps } from './painters';

beforeAll(() => COAST_ART.painters.load());

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
const STEPS = ['shore', 'land', 'maquis', 'pine'];

function record(name: string): { hash: string; parts: RecordedCost[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const p = createPainter(makeCanvas(OVERVIEW.rect.w * OVERVIEW.scale, OVERVIEW.rect.h * OVERVIEW.scale), { seed: COAST_ART.seed });
    const step = coastSteps(COAST_ART).find((s) => s.name === name)!;
    applyView(p, OVERVIEW);
    const marks = step.run(p);
    const parts: RecordedCost[] = [];
    rec.mark();
    while (marks && !marks.next().done) parts.push(rec.mark());
    parts.push(rec.mark());
    return { hash: rec.hash, parts };
  } finally {
    uninstall();
  }
}

describe('coast paint parts (GR2)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    for (const s of STEPS) runs[s] = record(s);
  }, 120_000);

  it('paints the shore with the same marks every time', () => {
    expect(runs.shore!.hash).toBe('e2b6526a');
  });

  it('keeps each step in many parts, each with a bounded number of pixel reads', () => {
    const most: Record<string, { parts: number; reads: number }> = {
      shore: { parts: 150, reads: 20 },
      land: { parts: 200, reads: 1 },
      maquis: { parts: 100, reads: 45 },
      pine: { parts: 120, reads: 3 },
    };
    for (const s of STEPS) {
      expect(runs[s]!.parts.length, s).toBeGreaterThanOrEqual(most[s]!.parts);
      expect(Math.max(...runs[s]!.parts.map((c) => c.reads)), s).toBeLessThanOrEqual(most[s]!.reads);
    }
  });
});
