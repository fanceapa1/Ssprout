import { describe, expect, it } from 'vitest';
import { gradeAt, NAMED_HOURS } from '../ambience/timeofday';
import { uiLight } from './ambient-light';

describe('uiLight', () => {
  it('leaves the paper almost untouched at noon', () => {
    const l = uiLight(gradeAt(NAMED_HOURS.noon));
    expect(l.dim).toBeGreaterThan(0.95);
    expect(l.dab.r).toBeGreaterThan(225);
  });

  it('dims slips and darkens dabs toward the night wash, but keeps slips readable', () => {
    const noon = uiLight(gradeAt(NAMED_HOURS.noon));
    const night = uiLight(gradeAt(NAMED_HOURS.night));
    expect(night.dim).toBeLessThan(noon.dim);
    expect(night.dim).toBeGreaterThanOrEqual(0.8);
    expect(night.dab.r + night.dab.g + night.dab.b).toBeLessThan(noon.dab.r + noon.dab.g + noon.dab.b - 60);
    // indigo night: blue keeps more than red
    expect(night.dab.b / night.dab.r).toBeGreaterThan(noon.dab.b / noon.dab.r);
  });
});
