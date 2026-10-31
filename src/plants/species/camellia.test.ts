import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { bloomMarks, bloomState } from '../lib/shrub-paint';
import { shrubSuite } from '../lib/suites';
import { buildCamellia } from './camellia';

shrubSuite('camellia', buildCamellia, { habitats: ['back', 'meadow'] });

describe('camellia blooms', () => {
  it('a bloom keeps its petals from bud to full bloom', () => {
    const plant = buildCamellia(createRng(3).fork('camellia'));
    const { bloom, bud, open } = plant.blooms[0]!;
    const counts = [0.5, 0.7, 0.85, 1].map((g) => bloomMarks(bloom, bloomState(g, bud, open)).length);
    expect(new Set(counts).size).toBe(1);
    const late = bloomState(1, bud, open);
    expect(late.open).toBe(1);
    expect(late.colour).toBe(1);
    expect(bloomState(0.2, bud, open).size).toBe(0);
  });
});
