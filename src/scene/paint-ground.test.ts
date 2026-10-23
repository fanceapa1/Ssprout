import { describe, expect, it } from 'vitest';
import { gardenScene } from './geometry';
import { PATH_GROUND } from './paint-land';
import { GROUND_TOP, onGrass } from './paint-ground';

describe('meadow marks (ADR 0186)', () => {
  const art = { pond: gardenScene.pond, path: PATH_GROUND, pavilion: gardenScene.pavilion };

  it('stay on the grass: off the water, the path and the engawa', () => {
    expect(onGrass(art, 800, 560, 6)).toBe(false); // the pond
    expect(onGrass(art, 800, 900, 6)).toBe(false); // the path
    expect(onGrass(art, 1450, 400, 6)).toBe(false); // the engawa
    expect(onGrass(art, 300, GROUND_TOP - 30, 6)).toBe(false); // the sky
    expect(onGrass(art, 200, 700, 6)).toBe(true);
    expect(onGrass(art, 1300, 880, 6)).toBe(true);
  });
});
