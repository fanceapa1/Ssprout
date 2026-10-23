/**
 * Ink icons (no icon fonts, no emoji): slightly uneven sumi strokes in a 24×24 box, round caps,
 * one colour (`currentColor`), sometimes a pale wash under the line. Kept as data so the same
 * glyph is inline SVG in the page (`ICONS`) and a Path2D drawing in the studio (`drawIcon`).
 * Redrawn for the app shell (ADR 0135): bolder lines and clearer metaphors for the garden tools.
 */
export interface IconStroke {
  d: string;
  /** opacity of this stroke (default 1) */
  o?: number;
  /** stroke width in the 24 box (default STROKE) */
  w?: number;
  /** a wash fill under the line, as an opacity (default none) */
  fill?: number;
}

export const STROKE = 1.65;

const SPEAKER = 'M3.8 9.4c1.5-.1 2.9-.1 4.1-.3l4.6-3.9c.4 4.4.4 9.2.1 13.6l-4.7-3.6c-1.3-.2-2.7-.2-4.1-.3-.3-1.8-.3-3.7 0-5.5z';

export const ICON_STROKES = {
  soundOn: [
    { d: SPEAKER, fill: 0.14 },
    { d: 'M15.4 9.1c1 .9 1.5 1.9 1.5 3 0 1.1-.5 2.1-1.4 2.9' },
    { d: 'M17.9 6.6c1.7 1.5 2.6 3.4 2.6 5.5 0 2.1-.9 4-2.5 5.4', o: 0.8 },
  ],
  soundOff: [
    { d: SPEAKER, fill: 0.08 },
    { d: 'M15.6 9.6c1.4 1.3 2.7 2.8 3.9 4.6', o: 0.85 },
    { d: 'M19.6 9.4c-1.4 1.4-2.7 3-3.8 4.8', o: 0.85 },
  ],
  floating: [
    { d: 'M2.9 5.6c5.9-.3 12-.3 18.2.1.3 4.2.3 8.5 0 12.7-6.1.3-12.1.3-18.1 0-.4-4.3-.4-8.6-.1-12.8z', o: 0.6 },
    { d: 'M11.6 11.2c2.6-.1 5.2-.1 7.4.1.2 1.9.2 3.8 0 5.6-2.5.1-5 .1-7.4 0-.2-1.9-.2-3.8 0-5.7z', fill: 0.22 },
    { d: 'M15.3 12.6v1.7l1.2.8', w: 1.4 },
  ],
  book: [
    { d: 'M12 6.6c-2.6-1.6-5.5-2-8.8-1.6.2 4.4.2 8.8 0 13.2 3.3-.3 6.2.1 8.8 1.6 2.6-1.5 5.5-1.9 8.8-1.6-.2-4.4-.2-8.8 0-13.2-3.3-.4-6.2 0-8.8 1.6z' },
    { d: 'M12 6.8c.1 4.1.1 8.2 0 12.3', o: 0.55 },
    { d: 'M5.7 9.4c1.5-.1 2.8.1 4.1.6', o: 0.4, w: 1.2 },
    { d: 'M5.7 12.2c1.5-.1 2.8.1 4.1.6', o: 0.4, w: 1.2 },
    { d: 'M16.6 16.6c-.2-1.7-.1-3.2.4-4.6', w: 1.3 },
    { d: 'M16.9 12.1c-1-.3-1.6-1-1.6-1.9.9-.1 1.5.5 1.8 1.2', fill: 0.3, w: 1.3 },
    { d: 'M17.1 12c.2-1 .8-1.7 1.7-1.8.2.9-.3 1.6-1.3 2', fill: 0.3, w: 1.3 },
    { d: 'M16.9 11.6c-.4-.9-.2-1.9.4-2.5.6.6.6 1.6-.2 2.4', fill: 0.3, w: 1.3 },
    { d: 'M16.8 14.8c.7-.6 1.5-.8 2.3-.6-.4.7-1.2 1-2.1.8', fill: 0.3, w: 1.2 },
  ],
  data: [
    { d: 'M4.2 14.9c.1 1.6.1 3.1.1 4.6 5.2.2 10.4.2 15.5 0 .1-1.6.1-3 0-4.6' },
    { d: 'M12 3.9c.1 3.6.1 7.1 0 10.6' },
    { d: 'M8.4 11.1c1.3 1.2 2.5 2.4 3.6 3.6 1.1-1.2 2.3-2.4 3.6-3.6' },
  ],
  info: [
    { d: 'M12 3.4c4.9-.1 8.7 3.7 8.7 8.6 0 4.9-3.8 8.7-8.7 8.7-4.8 0-8.6-3.8-8.7-8.5-.1-4.6 3.5-8.6 8-8.8', fill: 0.08 },
    { d: 'M12.1 10.6c.1 2 .1 3.9 0 5.8', w: 1.9 },
    { d: 'M12 7.4h.1', w: 2.6 },
  ],
  close: [{ d: 'M6.6 6.7c3.6 3.4 7.2 7 10.7 10.6' }, { d: 'M17.3 6.6c-3.7 3.4-7.2 7-10.6 10.7' }],
  back: [{ d: 'M14.8 6.2c-2.1 1.9-4.1 3.8-5.9 5.8 1.9 2 3.9 3.9 5.9 5.8' }],
  swap: [
    { d: 'M6.3 9.4c1.3-2.6 3.9-4 6.6-3.7 2 .2 3.7 1.3 4.6 3' },
    { d: 'M17.8 5.9c0 1.1-.1 2.3-.3 3.3-1.1 0-2.1-.1-3.2-.3' },
    { d: 'M17.7 14.6c-1.3 2.6-3.9 4-6.6 3.7-2-.2-3.7-1.3-4.6-3' },
    { d: 'M6.2 18.1c0-1.1.1-2.3.3-3.3 1.1 0 2.1.1 3.2.3' },
  ],
  sprout: [
    { d: 'M12 20.2c-.1-3.1.1-6 .7-8.6' },
    { d: 'M12.6 12.4c1.5-2.6 3.9-3.6 6.2-3.3-.8 2.6-3.2 4-6.2 3.3z', fill: 0.18 },
    { d: 'M12.3 14.3c-1.4-1.9-3.4-2.6-5.4-2.2.8 2 2.9 3 5.4 2.2z', o: 0.85, fill: 0.14 },
    { d: 'M8.3 20.3c2.4-.4 5-.4 7.6 0', o: 0.6 },
  ],
  wateringCan: [
    { d: 'M9.2 10.1c2.9-.3 5.8-.3 8.7 0 .3 2.9.2 5.9-.2 8.8-2.8.3-5.6.3-8.3 0-.4-2.9-.5-5.9-.2-8.8z', fill: 0.12 },
    { d: 'M9.3 12.3c-1.9-.9-3.6-2.3-5-4.1' },
    { d: 'M2.9 7.2c.6-.6 1.4-.9 2.2-.7.1.8-.2 1.6-.8 2.1-.6-.3-1.1-.8-1.4-1.4z' },
    { d: 'M17.8 11.4c1.6-.2 2.6.8 2.6 2.4 0 1.5-1 2.5-2.7 2.4', o: 0.85 },
    { d: 'M10.6 10c.4-2.1 1.7-3.3 3-3.3 1.4 0 2.6 1.2 2.9 3.3', o: 0.8 },
  ],
  drops: [
    { d: 'M8.4 6.2c1.3 1.9 2.2 3.2 2.2 4.4 0 1.3-1 2.2-2.2 2.2-1.2 0-2.2-.9-2.2-2.2 0-1.2.9-2.5 2.2-4.4z' },
    { d: 'M15.6 10.2c1.3 1.9 2.2 3.2 2.2 4.4 0 1.3-1 2.2-2.2 2.2s-2.2-.9-2.2-2.2c0-1.2.9-2.5 2.2-4.4z', o: 0.75 },
  ],
  tick: [{ d: 'M5.8 12.6c1.3 1.1 2.5 2.4 3.6 3.8 2.6-3.6 5.4-6.8 8.8-9.6' }],
  pause: [
    { d: 'M9.3 6.6c.2 3.6.2 7.2 0 10.8', w: 2.3 },
    { d: 'M14.8 6.5c.2 3.7.1 7.3-.1 10.9', w: 2.3 },
  ],
  play: [{ d: 'M8.6 6.3c3.4 1.7 6.6 3.6 9.3 5.7-2.8 2.1-5.9 4-9.3 5.7-.3-3.8-.3-7.6 0-11.4z', fill: 0.3 }],
  zoomIn: [
    { d: 'M12.1 5.6c.1 4.3.1 8.6-.1 12.9', w: 1.9 },
    { d: 'M5.7 12.1c4.3-.2 8.6-.2 12.7 0', w: 1.9 },
  ],
  zoomOut: [{ d: 'M5.6 12.2c4.4-.2 8.7-.2 12.8-.1', w: 1.9 }],
  wholeGarden: [
    { d: 'M3.6 8.6c0-1.4 0-2.7.1-4 1.3-.1 2.7-.1 4.1 0' },
    { d: 'M16.3 4.5c1.4-.1 2.8-.1 4.1.1.1 1.3.1 2.6 0 4' },
    { d: 'M20.4 15.5c.1 1.3.1 2.7 0 4-1.3.1-2.7.1-4.1 0' },
    { d: 'M7.7 19.6c-1.4.1-2.7 0-4-.1-.1-1.3-.1-2.6 0-4' },
    { d: 'M6.6 15.8c1.6-2.4 3.3-3.6 5.3-3.6 1.8 0 3.6 1.2 5.5 3.6', o: 0.7, fill: 0.14 },
  ],
  down: [
    { d: 'M12 5.2c.1 4.4.1 8.8 0 13.2' },
    { d: 'M7.4 13.8c1.6 1.5 3.1 3 4.6 4.6 1.5-1.6 3-3.1 4.6-4.6' },
  ],
} satisfies Record<string, IconStroke[]>;

export type IconName = keyof typeof ICON_STROKES;

const pathSvg = (s: IconStroke) =>
  `<path d="${s.d}"${s.o !== undefined ? ` opacity="${s.o}"` : ''}${s.w !== undefined ? ` stroke-width="${s.w}"` : ''}${
    s.fill ? ` fill="currentColor" fill-opacity="${s.fill}"` : ''
  }/>`;

const svg = (strokes: readonly IconStroke[]) =>
  `<svg class="ink-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${strokes
    .map(pathSvg)
    .join('')}</svg>`;

/** Inline SVG markup for every icon. */
export const ICONS = Object.fromEntries(Object.entries(ICON_STROKES).map(([k, v]) => [k, svg(v)])) as Record<IconName, string>;

/**
 * The sprout mark (ADR 0194): the one small sign beside what begins a planting ("Start studying",
 * "Plant another", "Schedule a session") and what is growing now. It is the sprout icon's own ink
 * strokes with its two leaves washed in sap green, cropped to the glyph, in place of the round red
 * "recording" dot, a generic web trope the owner rejected. Never pulses or glows.
 */
export const MARK_LEAF = '#8b9c5a';
/** the sprout glyph's box inside the 24 grid (x, y, w, h) */
export const MARK_BOX = [5.6, 7.6, 14.8, 14] as const;

export function sproutMarkSvg(cls = ''): string {
  const [stem, right, left, ground] = ICON_STROKES.sprout;
  return (
    `<svg class="sprout-mark${cls ? ` ${cls}` : ''}" viewBox="${MARK_BOX.join(' ')}" width="18" height="17" aria-hidden="true" focusable="false" ` +
    `fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">` +
    `<path class="leaf" d="${right!.d}" fill="${MARK_LEAF}" fill-opacity="0.78"/>` +
    `<path class="leaf" d="${left!.d}" fill="${MARK_LEAF}" fill-opacity="0.66" opacity="0.9"/>` +
    `<path d="${stem!.d}"/><path d="${ground!.d}" opacity="0.55"/></svg>`
  );
}

/** The sprout mark on a canvas (studio): `size` px wide with its top-left at (x, y). */
export function drawSproutMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ink: string, leaf = MARK_LEAF): void {
  const [bx, by, bw] = MARK_BOX;
  const k = size / bw;
  const [stem, right, left, ground] = ICON_STROKES.sprout;
  ctx.save();
  ctx.translate(x - bx * k, y - by * k);
  ctx.scale(k, k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.35;
  ctx.strokeStyle = ink;
  for (const [s, fill, o] of [
    [right!, 0.78, 1],
    [left!, 0.66, 0.9],
  ] as const) {
    const p = new Path2D(s.d);
    ctx.globalAlpha = fill * o;
    ctx.fillStyle = leaf;
    ctx.fill(p);
    ctx.globalAlpha = o;
    ctx.stroke(p);
  }
  ctx.globalAlpha = 1;
  ctx.stroke(new Path2D(stem!.d));
  ctx.globalAlpha = 0.55;
  ctx.stroke(new Path2D(ground!.d));
  ctx.restore();
}

/** Draw an icon into a 2D context (studio): `size` px square with its top-left at (x, y). */
export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const s of ICON_STROKES[name] as readonly IconStroke[]) {
    const p = new Path2D(s.d);
    const o = s.o ?? 1;
    if (s.fill) {
      ctx.globalAlpha = s.fill * o;
      ctx.fill(p);
    }
    ctx.globalAlpha = o;
    ctx.lineWidth = s.w ?? STROKE;
    ctx.stroke(p);
  }
  ctx.restore();
}
