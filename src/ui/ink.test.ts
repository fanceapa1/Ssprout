import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Type contrast (ADR 0136): every ink token used for text reads at ≥ 4.5:1 (WCAG AA) on the washi
 * paper, also on its deeper tone; the seal's cream label reads on the vermilion. Tokens are read
 * from ui.css itself, so a later tweak cannot quietly drop below the bar.
 */
const css = readFileSync(resolve(import.meta.dirname, 'ui.css'), 'utf8');

function token(name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (!m) throw new Error(`token ${name} is not a #rrggbb colour in ui.css`);
  return m[1]!;
}

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
export const contrast = (a: string, b: string) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('ink on paper', () => {
  const paper = token('--ui-paper');
  const deep = token('--ui-paper-deep');

  it.each(['--ui-ink', '--ui-ink-soft', '--ui-ink-mute', '--ui-vermilion-ink'])('%s reads at ≥ 4.5:1 on the paper', (name) => {
    expect(contrast(token(name), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(name), deep)).toBeGreaterThanOrEqual(4.5);
  });

  it('body ink is strong (≥ 9:1) and secondary ink is clearly lighter than it', () => {
    expect(contrast(token('--ui-ink'), paper)).toBeGreaterThanOrEqual(9);
    expect(contrast(token('--ui-ink-soft'), paper)).toBeLessThan(contrast(token('--ui-ink'), paper));
  });

  it('the seal label reads on the vermilion', () => {
    expect(contrast('#f7f0e1', token('--ui-vermilion'))).toBeGreaterThanOrEqual(4.5);
  });

  it('faint and ghost inks are only used for lines, never for text colour', () => {
    const textRules = [...css.matchAll(/(^|[\s;{])color:\s*var\((--ui-ink-(?:faint|ghost))\)/g)].map((m) => m[2]);
    expect(textRules).toEqual([]);
  });

  it('the base size is at least 20 px', () => {
    const m = /\.ui-root \{[^}]*font-size:\s*(\d+(?:\.\d+)?)px/.exec(css);
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(20);
  });
});
