/** The recording canvas's quantised numbers (docs/TESTING.md): pins that hold on every platform. */
import { describe, expect, it } from 'vitest';
import { PaintRecorder, RecordingCanvas, quantise, quantiseNumber } from './paint-record';

describe('quantise', () => {
  it('rounds fractions to 7 significant digits, so last-bit Math differences hash alike', () => {
    // the first differing call of the wash recipe on arm64 and on x64 (devlog 59)
    expect(quantise('396x244 lineTo(199.07858887883023,119.14054330670139)')).toBe('396x244 lineTo(199.0786,119.1405)');
    expect(quantise('396x244 lineTo(199.07858887883023,119.14054330670137)')).toBe('396x244 lineTo(199.0786,119.1405)');
    expect(quantise('fillStyle=rgba(0,0,0,0.12431546924402936)')).toBe('fillStyle=rgba(0,0,0,0.1243155)');
    expect(quantise('setTransform(1.6,-2.5e-7,3e-12,-0.000123456789,-40,-30)')).toBe('setTransform(1.6,-2.5e-7,0,-0.0001234568,-40,-30)');
  });

  it('quantises numbers passed as numbers the same way', () => {
    expect(quantiseNumber(119.14054330670139)).toBe('119.1405');
    expect(quantiseNumber(-2.5e-7)).toBe('-2.5e-7');
    expect(quantiseNumber(3e-12)).toBe('0');
    expect(quantiseNumber(-40)).toBe('-40');
  });

  it('keeps integers, sizes and hex colours as they are', () => {
    const line = 'new 396x244 fillStyle=#1e2a3b strokeStyle=#11e2ff drawImage(canvas 12x34,-40,30)';
    expect(quantise(line)).toBe(line);
  });

  it('hashes a call’s numbers quantised by default and exact when asked', () => {
    const hash = (exact: boolean, y: number) => {
      const r = new PaintRecorder({ exact });
      const uninstall = r.install();
      try {
        const ctx = new RecordingCanvas(20, 10).getContext() as CanvasRenderingContext2D;
        ctx.lineTo(199.07858887883023, y);
        ctx.fillStyle = `rgba(0,0,0,${y / 1000})`;
        return r.hash;
      } finally {
        uninstall();
      }
    };
    expect(hash(false, 119.14054330670139)).toBe(hash(false, 119.14054330670137));
    expect(hash(true, 119.14054330670139)).not.toBe(hash(true, 119.14054330670137));
    expect(hash(false, 119.14054330670139)).not.toBe(hash(false, 119.1406));
  });
});
