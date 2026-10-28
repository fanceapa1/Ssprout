/**
 * Studio: the waterfall's water (S7): the falling sheet (still), the plunge pool, the outflow
 * stream with its riffles, and the whole painting so far.
 */
import { WORLD_H, WORLD_W } from '../../render/viewport';
import type { StudioSection } from '../../studio/types';
import { region } from './rocks.studio';

const WET = ['gorge', 'cliff', 'ledges', 'water', 'falls'];

const section: StudioSection = {
  id: 'waterfall-water',
  title: 'Scenery · waterfall water',
  order: 106,
  entries: [
    region('water-falls', 'falls (still): streaks, white paper, lifted threads, thin edges over wet rock, foam', { x: 460, y: 260, w: 320, h: 400 }, WET, false, 560),
    region('water-pool', 'plunge pool: deep heart, warm shallows, cliff reflection, churn at the foot', { x: 400, y: 560, w: 680, h: 220 }, WET, true, 800),
    region('water-stream', 'outflow stream: S curve widening to the viewer, ripple strokes, riffles round rocks', { x: 900, y: 660, w: 440, h: 340 }, WET, true, 640),
    region('water-scene', 'the painting so far: rock, water and boulders over the vegetation and sky placeholders', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined, true, 800),
  ],
};

export default section;
