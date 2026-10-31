import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { shrubSuite } from '../lib/suites';
import { buildChrysanthemum } from './chrysanthemum';

shrubSuite('chrysanthemum', buildChrysanthemum, { habitats: ['meadow', 'path'], sizeClass: 'medium' });

describe('chrysanthemum colourways', () => {
  it('seeds vary the colourway', () => {
    const colours = new Set<string>();
    for (let s = 0; s < 24; s++) colours.add(buildChrysanthemum(createRng(s).fork('chrysanthemum')).colour.ray);
    expect(colours.size).toBeGreaterThanOrEqual(3);
  });
});
