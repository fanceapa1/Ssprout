import { createRng } from '../core/rng';
import type { StudioSection } from '../studio/types';
import { brushOutline, layoutPath, stonePath, type PathLayout, type PathPlan } from './wayfinding-path';

/**
 * The guiding path through the dock (ADR 0202), drawn with the page's own geometry: the line out
 * of the stepping stones, the lane with its meander on a wide screen and the straight gutter on a
 * phone, the stones that mark each heading (resting, and the one being read), and the draw-in.
 * The page draws the same paths as SVG (src/ui/wayfinding.ts) with the colours below.
 */
const INK = 'rgba(74, 68, 60, 0.42)';
const STONE = 'rgba(157, 151, 135, 0.5)';
const STONE_HERE = 'rgba(126, 122, 110, 0.78)';
const RIM = 'rgba(98, 92, 82, 0.5)';
const TEXT = '#3b352e';
const SOFT = '#5c5449';
const SECTIONS = [
  { id: 'session', title: 'Study', helper: 'Name a task, choose a plant, and watch it grow while you work.' },
  { id: 'plant', title: 'Your plant', helper: 'The seedling for this session. It grows with every minute you focus.' },
  { id: 'calendar', title: 'Calendar', helper: 'Plan a session, or tap a day to see what grew.' },
  { id: 'tools', title: 'Garden tools', helper: 'Sound, a floating timer and your keepsakes.' },
];

/** The bottom of the garden: a few stepping stones fading into the paper. */
function gardenEdge(ctx: CanvasRenderingContext2D, w: number, cx: number, bottom: number, scale: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, bottom);
  g.addColorStop(0, 'rgba(168, 181, 114, 0.38)');
  g.addColorStop(1, 'rgba(168, 181, 114, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, bottom);
  const rng = createRng('studio-stones');
  [
    [0, 0.2, 1],
    [-0.06, 0.45, 0.86],
    [0.04, 0.7, 0.74],
  ].forEach(([dx, fy, k], i) => {
    ctx.save();
    ctx.translate(cx + dx! * w + rng.range(-3, 3), bottom * fy!);
    ctx.fillStyle = `rgba(157, 151, 135, ${0.55 - i * 0.12})`;
    ctx.fill(new Path2D(stonePath(`edge-${i}`, 34 * k! * scale, 11 * k! * scale)));
    ctx.restore();
  });
}

function drawPath(ctx: CanvasRenderingContext2D, layout: PathLayout, width: number, stone: number, here: string | null, reveal = 1): void {
  ctx.save();
  if (reveal < 1) {
    // the draw-in: only the part of the line the brush has reached
    const upTo = layout.length * reveal;
    const reached = layout.points.filter((p) => p.s <= upTo);
    const last = reached[reached.length - 1];
    if (!last) {
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, last.y + 2);
    ctx.clip();
  }
  ctx.fillStyle = INK;
  ctx.fill(new Path2D(brushOutline(layout, { width, stopRadius: stone * 0.62, fadeIn: 120, liftOff: 60, seed: 'dock' })));
  ctx.restore();
  for (const st of layout.stops) {
    const shown = reveal >= 1 ? 1 : Math.max(0, Math.min(1, (reveal - st.s / layout.length) * 4));
    if (shown <= 0) continue;
    ctx.save();
    ctx.globalAlpha = shown;
    ctx.translate(st.x, st.y);
    const p = new Path2D(stonePath(st.id, stone / 2, stone * 0.3));
    ctx.fillStyle = st.id === here ? STONE_HERE : STONE;
    ctx.fill(p);
    ctx.strokeStyle = RIM;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([26, 3, 9, 4]);
    ctx.stroke(p);
    ctx.restore();
  }
}

/** A dock mock: the garden's edge, then each heading with its helper line and a block of content. */
function dock(canvas: HTMLCanvasElement, o: { phone: boolean; here: string | null; reveal?: number; pixelRatio: number }): void {
  const ctx = canvas.getContext('2d')!;
  const k = o.pixelRatio;
  ctx.scale(k, k);
  const w = canvas.width / k;
  const lane = o.phone ? 19 : 34;
  const left = o.phone ? 38 : 84;
  const top = 96;
  const gap = o.phone ? 150 : 170;
  gardenEdge(ctx, w, w * 0.52, 70, o.phone ? 0.6 : 1);
  const stops = SECTIONS.map((s, i) => ({ id: s.id, y: top + 20 + i * gap }));
  SECTIONS.forEach((s, i) => {
    const y = top + i * gap;
    ctx.fillStyle = TEXT;
    ctx.font = `500 ${o.phone ? 22 : 25}px "Shippori Mincho", serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(s.title, left, y + 20);
    ctx.fillStyle = SOFT;
    ctx.font = `italic 500 ${o.phone ? 15 : 17}px "Cormorant Garamond", serif`;
    const words = s.helper.split(' ');
    let line = '';
    let ly = y + 48;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > w - left - 16 && line) {
        ctx.fillText(line, left, ly);
        line = word;
        ly += 20;
      } else line = next;
    }
    ctx.fillText(line, left, ly);
    // the section's content, as a faint block
    ctx.fillStyle = 'rgba(59, 53, 46, 0.06)';
    ctx.fillRect(left, ly + 20, Math.min(w - left - 16, o.phone ? 300 : 360), gap - (ly - y) - 50);
  });
  const layout = layoutPath({
    start: { x: w * 0.52, y: 52 },
    lane: left - lane,
    contentLeft: left,
    clearTop: top + 8,
    stops,
    tail: 60,
    sway: o.phone ? 0 : 12,
    seed: 'dock',
  } satisfies PathPlan);
  drawPath(ctx, layout, o.phone ? 2.1 : 2.6, o.phone ? 17 : 23, o.here, o.reveal ?? 1);
}

const section: StudioSection = {
  id: 'ui-wayfinding',
  title: 'UI · the guiding path',
  order: 523,
  entries: [
    {
      id: 'path-wide',
      label: 'wide screens: out of the stepping stones, across to the lane, a meander inside it, a stone beside each heading (Calendar being read)',
      w: 560,
      h: 800,
      render(canvas, { pixelRatio }) {
        dock(canvas, { phone: false, here: 'calendar', pixelRatio });
      },
    },
    {
      id: 'path-phone',
      label: 'a phone: a straight line down the left gutter, a smaller stone beside each stacked heading',
      w: 360,
      h: 740,
      render(canvas, { pixelRatio }) {
        dock(canvas, { phone: true, here: 'session', pixelRatio });
      },
    },
    {
      id: 'stops',
      label: 'stops: each heading’s stone at rest, and darker for the section being read (wide, then phone sizes)',
      w: 420,
      h: 120,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio * 2, pixelRatio * 2);
        SECTIONS.forEach((s, i) => {
          for (const [row, size, here] of [
            [0, 23, false],
            [1, 23, true],
          ] as const) {
            ctx.save();
            ctx.translate(26 + i * 50, 13 + row * 19);
            const p = new Path2D(stonePath(s.id, size / 2, size * 0.3));
            ctx.fillStyle = here ? STONE_HERE : STONE;
            ctx.fill(p);
            ctx.strokeStyle = RIM;
            ctx.lineWidth = 0.6;
            ctx.setLineDash([26, 3, 9, 4]);
            ctx.stroke(p);
            ctx.restore();
          }
          ctx.save();
          ctx.translate(26 + i * 50, 50);
          const small = new Path2D(stonePath(s.id, 17 / 2, 17 * 0.3));
          ctx.fillStyle = STONE;
          ctx.fill(small);
          ctx.restore();
        });
      },
    },
    {
      id: 'draw-in',
      label: 'the draw-in on first view (2.6 s, loops here; never with reduced motion)',
      w: 560,
      h: 800,
      animated: true,
      render(canvas, { t, pixelRatio }) {
        const u = (t % 4) / 2.6;
        const eased = u >= 1 ? 1 : 1 - Math.pow(1 - u, 3);
        dock(canvas, { phone: false, here: null, reveal: eased, pixelRatio });
      },
    },
  ],
};

export default section;
