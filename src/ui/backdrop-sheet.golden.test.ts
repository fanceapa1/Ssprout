import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SHEET, sheetMaskSvg, sheetShadowSvg } from './backdrop-sheet';

/**
 * The sheets' SVG, byte for byte, per seed (ADR 0223). The fingerprints were taken from the
 * original 256 × 256 noise lattices; the cheaper noise must reproduce them exactly. Sizes cover a
 * desktop column, the full-width calendar, a phone's shallower wash, a tall sheet and a wide one
 * whose fibre octave wraps around the lattice.
 */
const fingerprint = (svg: string) => `${svg.length}:${createHash('sha256').update(svg).digest('hex').slice(0, 16)}`;

const CASES = [
  ['session', 520, 430, 'leaf'],
  ['plant', 520, 610, 'leaf'],
  ['calendar', 1046, 640, 'firm'],
  ['tools', 1046, 180, 'leaf'],
  ['session', 330, 2400, 'leaf'],
  ['tools', 1900, 260, 'leaf'],
] as const;

describe('backdrop sheet · byte-identical output per seed', () => {
  it('draws the same mask and shadow SVG as the original lattices', () => {
    const out = CASES.map(([seed, w, h, strength]) => {
      // a narrow sheet uses a shallower wash, as backdrop.ts does
      const st = w < 520 ? { ...SHEET[strength], depth: SHEET[strength].depth * 0.66 } : SHEET[strength];
      return `${seed} ${w}x${h} ${strength} mask ${fingerprint(sheetMaskSvg(seed, w, h, st))} shadow ${fingerprint(sheetShadowSvg(seed, w, h, st))}`;
    });
    expect(out).toMatchInlineSnapshot(`
      [
        "session 520x430 leaf mask 9390:2157211ee235ccda shadow 18728:221554883f0e47bc",
        "plant 520x610 leaf mask 11261:03588ea64c3e77b0 shadow 22155:792864f60e0c25b2",
        "calendar 1046x640 firm mask 17252:4a11d0b6527a6e3d shadow 33664:66c62afda5fafc74",
        "tools 1046x180 leaf mask 12345:7f0bc7a8c308e50e shadow 24305:d484beaafb18bb70",
        "session 330x2400 leaf mask 28942:d0ff7ae27203f2a9 shadow 54620:6b660ec054336b0f",
        "tools 1900x260 leaf mask 22404:b2966a0cbe2631d3 shadow 43708:28ed58e03c875619",
      ]
    `);
  });
});
