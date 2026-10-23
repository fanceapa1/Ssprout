import { createRng } from '../core/rng';
import { allSpecies } from '../plants/registry';
import type { StudioSection } from '../studio/types';
import { paintPlan, paintWash, WASH, washTone } from './calendar-art';
import { layoutColumns, monthGrid, noonOf } from './calendar-model';
import { dayLabel, hoursFor, pickerFormat, splitTime, timeLabel } from './pickers';
import { drawSproutMark } from './icons';
import { deckledPath, deckledRoundPath } from './paper';

/**
 * The calendar's painted pieces (ADRs 0175–0177), redrawn with the page's own paths on a fixture
 * day (Thursday 22 October, now 15:20): the washes of each kind of block, a day and a week
 * timeline with overlapping blocks laid out by `layoutColumns`, the month's pigment dabs and
 * rings, and the waiting card with its slip on the garden.
 */
const INK = '#3b352e';
const SOFT = '#5c5449';
const MUTE = '#6b6256';
const PAPER = '#f3ecd9';
const VERMILION = '#ad452d';
const DISPLAY = '"Shippori Mincho", serif';
const BODY = '"Cormorant Garamond", serif';

const color = (id: string, fallback: string) => allSpecies().find((s) => s.id === id)?.bloomColor ?? fallback;

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, fill = INK, maxW?: number): void {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textBaseline = 'middle';
  if (maxW !== undefined && ctx.measureText(s).width > maxW) {
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    s = `${s}…`;
  }
  ctx.fillText(s, x, y);
}

function slip(ctx: CanvasRenderingContext2D, seed: string, x: number, y: number, w: number, h: number, fill = PAPER, alpha = 0.95): void {
  const p = new Path2D(deckledPath(createRng(seed)));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 1000, h / 1000);
  ctx.fillStyle = fill;
  ctx.globalAlpha = alpha;
  ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.3;
  const q = new Path2D();
  q.addPath(p, new DOMMatrix().translate(x, y).scale(w / 1000, h / 1000));
  ctx.stroke(q);
  ctx.restore();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, alpha = 0.85): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.08, r * 0.94, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function seal(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, w: number, h: number): void {
  slip(ctx, 'seal-0', x, y, w, h, VERMILION, 0.97);
  ctx.strokeStyle = 'rgba(247, 240, 225, 0.42)';
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  text(ctx, label, x + w / 2 - ctx.measureText(label).width / 2 - 4, y + h / 2 + 1, `16px ${DISPLAY}`, '#f7f0e1');
}

type Kind = 'completed' | 'cancelled' | 'growing' | 'waiting' | 'upcoming' | 'due' | 'missed';
interface Fx {
  id: string;
  kind: Kind;
  day: number;
  start: number; // hours
  end: number;
  title: string;
  meta: string;
  species?: string;
}

const H = 3_600_000;
/** A fixture week (Mon 19 … Sun 25 October): sessions, a growing one, plans. */
const WEEK: Fx[] = [
  { id: 'a', kind: 'completed', day: 0, start: 9.2, end: 10.1, title: 'Biology ch. 4', meta: 'Japanese Iris · 50 min', species: 'japanese-iris' },
  { id: 'b', kind: 'completed', day: 0, start: 13, end: 14.6, title: 'Essay draft', meta: 'Wisteria · 1 h 30', species: 'wisteria' },
  { id: 'c', kind: 'cancelled', day: 1, start: 10.5, end: 10.8, title: 'Statistics', meta: 'ended early', species: 'cosmos' },
  { id: 'd', kind: 'completed', day: 2, start: 11, end: 12, title: 'French verbs', meta: 'Violet · 50 min', species: 'violet' },
  { id: 'e', kind: 'missed', day: 2, start: 17.5, end: 18.3, title: 'Reading', meta: 'passed' },
  { id: 'f', kind: 'completed', day: 3, start: 9, end: 10.7, title: 'Thesis outline', meta: 'Japanese Maple · 1 h 30', species: 'japanese-maple' },
  { id: 'g', kind: 'completed', day: 3, start: 9.7, end: 10.2, title: 'Kanji', meta: 'Forget-me-not · 25 min', species: 'forget-me-not' },
  { id: 'h', kind: 'waiting', day: 3, start: 13.1, end: 13.6, title: 'Problem set', meta: 'Dandelion · waiting', species: 'dandelion' },
  { id: 'i', kind: 'growing', day: 3, start: 14.6, end: 15.33, title: 'History reading', meta: 'Hydrangea · growing', species: 'hydrangea' },
  { id: 'j', kind: 'due', day: 3, start: 15, end: 15.5, title: 'Japanese kanji', meta: 'now' },
  { id: 'k', kind: 'upcoming', day: 3, start: 17.5, end: 18.33, title: 'Essay draft', meta: '50 min' },
  { id: 'l', kind: 'upcoming', day: 5, start: 10, end: 11.5, title: 'Seminar', meta: '1 h 30' },
];
const TODAY = 3;
const NOW = 15.33;

function block(ctx: CanvasRenderingContext2D, f: Fx, x: number, y: number, w: number, h: number, compact: boolean): void {
  const seed = `wash-${f.id}`;
  if (f.species) {
    const kind = f.kind === 'cancelled' ? WASH.faint : f.kind === 'growing' || f.kind === 'waiting' ? WASH.growing : WASH.bloom;
    paintWash(ctx, x, y, w, h, seed, color(f.species, '#8b9c5a'), kind);
  } else paintPlan(ctx, x, y, w, h, seed, f.kind === 'missed' ? 0.22 : 0.42);
  const faint = f.kind === 'cancelled' || f.kind === 'missed';
  const hh = Math.floor(f.start);
  const mm = String(Math.round((f.start - hh) * 60)).padStart(2, '0');
  const t = `${hh}:${mm}`;
  if (compact) {
    text(ctx, f.title, x + 5, y + 10, `12.5px ${DISPLAY}`, faint ? MUTE : INK, w - 8);
    return;
  }
  text(ctx, t, x + 9, y + 11, `12px ${DISPLAY}`, faint ? MUTE : SOFT);
  text(ctx, f.title, x + 9 + ctx.measureText(t).width + 6, y + 11, faint ? `italic 15px ${BODY}` : `14.5px ${DISPLAY}`, faint ? MUTE : INK, w - 60);
  if (h > 34) text(ctx, f.meta, x + 9, y + 29, `italic 13.5px ${BODY}`, f.kind === 'due' ? VERMILION : SOFT, w - 14);
  if (f.kind === 'due' || f.kind === 'growing') drawSproutMark(ctx, x + w - 16, y + 3, 12, SOFT);
}

function hours(ctx: CanvasRenderingContext2D, from: number, to: number, top: number, hourPx: number, width: number): void {
  for (let hr = from; hr <= to; hr++) {
    const y = top + (hr - from) * hourPx;
    text(ctx, `${hr}`, 14, y, `13px ${DISPLAY}`, MUTE);
    ctx.fillStyle = 'rgba(59,53,46,0.16)';
    for (let x = 46; x < width - 6; x += 7) ctx.fillRect(x, y, 1, 1);
  }
}

function nowLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = 'rgba(173,69,45,0.22)';
  ctx.fillRect(x, y, w, 1);
  // a firm brush stroke at the rail, thinning out (no round head, ADR 0194)
  const g = ctx.createLinearGradient(x - 6, 0, x + 28, 0);
  g.addColorStop(0, 'rgba(173,69,45,0.85)');
  g.addColorStop(1, 'rgba(173,69,45,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x + 11, y, 17, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function timeline(ctx: CanvasRenderingContext2D, days: number[], w: number, from: number, to: number, hourPx: number): void {
  const top = 14;
  hours(ctx, from, to, top, hourPx, w);
  const colW = (w - 52) / days.length;
  days.forEach((day, i) => {
    const x0 = 46 + i * colW;
    const items = WEEK.filter((f) => f.day === day).map((f) => ({ ...f, startMs: f.start * H, endMs: f.end * H }));
    const placed = layoutColumns(items.map((f) => ({ f, start: f.startMs, end: f.endMs })), 0.45 * H);
    for (const p of placed) {
      const f = p.item.f;
      const bw = (colW - 4) / p.cols;
      const y = top + (f.start - from) * hourPx;
      const h = Math.max(0.45, f.end - f.start) * hourPx;
      block(ctx, f, x0 + p.col * bw + 2, y, bw - 2, h - 2, days.length > 1);
    }
    if (day === TODAY) nowLine(ctx, x0, top + (NOW - from) * hourPx, colW - 4);
  });
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, opacity: number): void {
  const p = new Path2D(deckledRoundPath(createRng(`ring-${x}-${y}`), 48, 0.05));
  ctx.save();
  ctx.translate(x - r, y - r);
  ctx.scale((2 * r) / 1000, (2 * r) / 1000);
  ctx.strokeStyle = colour;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = (1.6 * 1000) / (2 * r);
  ctx.stroke(p);
  ctx.restore();
}

const section: StudioSection = {
  id: 'calendar',
  title: 'UI · calendar & scheduling',
  order: 523,
  entries: [
    {
      id: 'washes',
      label: 'block washes: bloomed (in each plant’s colour), growing, waiting, ended early, planned, due, passed',
      w: 620,
      h: 210,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        const ids = ['japanese-iris', 'wisteria', 'violet', 'cosmos', 'japanese-maple', 'anemone', 'dandelion', 'hydrangea'];
        ids.forEach((id, i) => {
          paintWash(ctx, 10 + (i % 4) * 150, 10 + Math.floor(i / 4) * 52, 140, 44, `s${seed}-${i}`, color(id, '#8b9c5a'));
          text(ctx, id, 20 + (i % 4) * 150, 32 + Math.floor(i / 4) * 52, `13px ${DISPLAY}`);
        });
        const row = 128;
        paintWash(ctx, 10, row, 140, 44, `g${seed}`, color('hydrangea', '#9a8cc4'), WASH.growing);
        text(ctx, 'growing', 20, row + 22, `italic 14px ${BODY}`, SOFT);
        paintWash(ctx, 160, row, 140, 44, `c${seed}`, color('cosmos', '#e8a7a9'), WASH.faint);
        text(ctx, 'ended early', 170, row + 22, `italic 14px ${BODY}`, MUTE);
        paintPlan(ctx, 310, row, 140, 44, `p${seed}`);
        text(ctx, 'planned', 320, row + 22, `14px ${DISPLAY}`);
        paintPlan(ctx, 460, row, 140, 44, `m${seed}`, 0.22);
        text(ctx, 'passed', 470, row + 22, `italic 14px ${BODY}`, MUTE);
        paintPlan(ctx, 310, row + 52, 290, 26, `d${seed}`);
        text(ctx, 'due now', 320, row + 65, `14px ${DISPLAY}`);
        drawSproutMark(ctx, 582, row + 55, 12, SOFT);
      },
    },
    {
      id: 'day',
      label: 'Daily: Thursday 8:00–18:00, overlaps side by side, the now line at 15:20',
      w: 520,
      h: 600,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        timeline(ctx, [TODAY], 520, 8, 18, 56);
      },
    },
    {
      id: 'week',
      label: 'Weekly: Monday first, seven narrow columns of washes and plans',
      w: 760,
      h: 560,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const colW = (760 - 52) / 7;
        names.forEach((n, i) => {
          const cx = 46 + i * colW + colW / 2;
          text(ctx, n, cx - 12, 12, `italic 14px ${BODY}`, SOFT);
          text(ctx, String(19 + i), cx - 8, 32, `16px ${DISPLAY}`);
          if (i === TODAY) ring(ctx, cx, 32, 15, VERMILION, 0.7);
        });
        ctx.translate(0, 44);
        timeline(ctx, [0, 1, 2, 3, 4, 5, 6], 760, 8, 17, 52);
      },
    },
    {
      id: 'month',
      label: 'Monthly: pigment dabs per bloom, minutes studied, ink rings for plans (faint when passed), today ringed',
      w: 700,
      h: 520,
      render(canvas, { pixelRatio, seed }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        const rng = createRng(`month-${seed}`);
        const pool = ['japanese-iris', 'wisteria', 'violet', 'cosmos', 'japanese-maple', 'forget-me-not', 'dandelion', 'hydrangea', 'tree-peony'];
        const cw = 700 / 7;
        const ch = 92;
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((n, i) => text(ctx, n, i * cw + cw / 2 - 12, 12, `italic 14px ${BODY}`, SOFT));
        for (let i = 0; i < 35; i++) {
          const day = i - 2; // October 2026 starts on a Thursday
          const date = day < 1 ? 28 + day + 2 : day > 31 ? day - 31 : day;
          const other = day < 1 || day > 31;
          const x = (i % 7) * cw;
          const y = 30 + Math.floor(i / 7) * ch;
          const cx = x + cw / 2;
          text(ctx, String(date), cx - (date > 9 ? 9 : 5), y + 14, `${other ? 14 : 16}px ${DISPLAY}`, other ? MUTE : INK);
          if (day === 22) ring(ctx, cx, y + 14, 16, VERMILION, 0.7);
          const past = day <= 22;
          const blooms = past && rng.chance(0.75) ? rng.int(1, 3) : 0;
          let dx = cx - (blooms * 16) / 2 + 7;
          for (let b = 0; b < blooms; b++, dx += 16) {
            const [r, g, bl] = washTone(color(rng.pick(pool), '#8b9c5a'));
            dot(ctx, dx, y + 40, 6.4, `rgb(${r},${g},${bl})`, other ? 0.5 : 0.9);
          }
          const planned = day > 22 && day <= 31 && (i % 7) < 5 ? 1 : 0;
          const passed = past && (i % 7) < 5 && rng.chance(0.25) ? 1 : 0;
          if (planned) ring(ctx, dx, y + 40, 6.2, INK, 0.55);
          if (passed) ring(ctx, dx, y + 40, 6.2, INK, 0.24);
          if (blooms) text(ctx, `${blooms * 35 + rng.int(0, 4) * 5} min`, cx - 22, y + 66, `italic 14px ${BODY}`, SOFT);
        }
      },
    },
    {
      id: 'waiting-card',
      label: 'the waiting card (Start · Not this time), at the limit of three (See them), and its slip on the garden',
      w: 520,
      h: 470,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        const card = (y: number, limit: boolean) => {
          slip(ctx, 'slip-1', 10, y, 480, limit ? 196 : 150);
          drawSproutMark(ctx, 24, y + 18, 16, SOFT);
          text(ctx, 'Planned for 3:40 PM', 46, y + 26, `italic 17px ${BODY}`, SOFT);
          text(ctx, 'Japanese kanji', 32, y + 56, `21px ${DISPLAY}`);
          text(ctx, '50 min · Pomodoro', 32, y + 82, `17px ${BODY}`, SOFT);
          if (limit) {
            text(ctx, 'Three seedlings are already growing. When one blooms or', 32, y + 110, `17px ${BODY}`);
            text(ctx, 'you end one, this can begin — or switch to one of them now.', 32, y + 132, `17px ${BODY}`);
            slip(ctx, 'faint', 26, y + 148, 100, 38);
            text(ctx, 'See them', 44, y + 167, `17px ${BODY}`);
            text(ctx, 'Not this time', 150, y + 167, `17px ${BODY}`);
          } else {
            seal(ctx, 'Start', 30, y + 98, 96, 42);
            text(ctx, 'Not this time', 150, y + 119, `17px ${BODY}`);
          }
        };
        card(10, false);
        card(176, true);
        // the slip over a garden wash
        const g = ctx.createLinearGradient(0, 390, 0, 470);
        g.addColorStop(0, '#b9c4a0');
        g.addColorStop(1, '#d9d6b8');
        ctx.fillStyle = g;
        ctx.fillRect(0, 390, 520, 80);
        slip(ctx, 'dense-0', 70, 405, 380, 46);
        text(ctx, 'Japanese kanji', 88, 428, `16px ${DISPLAY}`);
        text(ctx, '· its time has come', 210, 428, `italic 16px ${BODY}`, SOFT);
        text(ctx, 'Start', 390, 428, `16px ${DISPLAY}`, '#8f3524');
      },
    },
    {
      id: 'pickers',
      label: 'the schedule editor’s day and time pickers (ADR 0192): en-US on the left, en-GB on the right, 4:30 PM on 24 October',
      w: 900,
      h: 520,
      render(canvas, { pixelRatio }) {
        const ctx = canvas.getContext('2d')!;
        ctx.scale(pixelRatio, pixelRatio);
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, 900, 520);
        const ring = (cx: number, cy: number, r: number, seed: string, stroke: string, alpha: number) => {
          const p = new Path2D(deckledRoundPath(createRng(seed), 48, 0.05));
          const q = new Path2D();
          q.addPath(p, new DOMMatrix().translate(cx - r, cy - r).scale((2 * r) / 1000, (2 * r) / 1000));
          ctx.save();
          ctx.strokeStyle = stroke;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.6;
          ctx.stroke(q);
          ctx.restore();
        };
        const column = (x0: number, locale: string, weekStartsOn: number) => {
          const f = pickerFormat(locale);
          const date = '2026-10-24';
          const time = '16:30';
          // the two fields
          const field = (x: number, label: string, value: string, open: boolean) => {
            ctx.fillStyle = 'rgba(255, 252, 244, 0.6)';
            ctx.fillRect(x, 16, 200, 56);
            ctx.fillStyle = open ? SOFT : 'rgba(59, 53, 46, 0.3)';
            ctx.fillRect(x, 71, 200, 1.4);
            text(ctx, label, x + 10, 30, `italic 15px ${BODY}`, SOFT);
            text(ctx, value, x + 10, 54, `19px ${BODY}`, INK, 160);
          };
          field(x0, 'day', dayLabel(date, '2026-10-23', f), true);
          field(x0 + 214, 'time', timeLabel(time, f), false);
          // the month, unfolded under them
          slip(ctx, 'faint', x0, 86, 400, 286, '#f6f0df', 0.9);
          text(ctx, f.month.format(noonOf(date)), x0 + 200 - 50, 110, `17px ${DISPLAY}`);
          text(ctx, '‹', x0 + 22, 110, `22px ${BODY}`);
          text(ctx, '›', x0 + 370, 110, `22px ${BODY}`);
          const weeks = monthGrid(noonOf(date), weekStartsOn);
          ctx.textAlign = 'center';
          weeks[0]!.forEach((d, i) => text(ctx, f.weekday.format(noonOf(d)), x0 + 40 + i * 53, 138, `italic 14px ${BODY}`, SOFT));
          weeks.forEach((row, r) =>
            row.forEach((d, i) => {
              const cx = x0 + 40 + i * 53;
              const cy = 166 + r * 38;
              const other = d.slice(5, 7) !== '10';
              if (d === date) ring(cx, cy, 17, 'today', VERMILION, 0.7);
              text(ctx, String(Number(d.slice(8))), cx, cy, `${d === date ? 600 : 500} 17px ${BODY}`, other || d < '2026-10-23' ? MUTE : INK);
              if (d === '2026-10-23') {
                ctx.fillStyle = VERMILION;
                ctx.globalAlpha = 0.7;
                ctx.fillRect(cx - 8, cy + 10, 16, 1.3);
                ctx.globalAlpha = 1;
              }
            }),
          );
          // the time chips
          slip(ctx, 'faint', x0, 384, 400, 126, '#f6f0df', 0.9);
          const p = splitTime(time, f.twelve);
          const hours = hoursFor(f.twelve).slice(0, 12);
          hours.forEach((hr, i) => {
            const cx = x0 + 34 + i * 30;
            if (hr === p.hour) slip(ctx, 'slip-1', cx - 14, 398, 28, 30, '#f8f3e6', 0.9);
            text(ctx, f.twelve ? String(hr) : String(hr).padStart(2, '0'), cx, 414, `${hr === p.hour ? 600 : 500} 15px ${BODY}`);
          });
          [0, 15, 30, 45].forEach((m, i) => {
            const cx = x0 + 40 + i * 54;
            if (m === p.minute) slip(ctx, 'slip-1', cx - 22, 438, 44, 30, '#f8f3e6', 0.9);
            text(ctx, `${f.sep}${String(m).padStart(2, '0')}`, cx, 454, `${m === p.minute ? 600 : 500} 15px ${BODY}`);
          });
          if (f.twelve) {
            f.periods.forEach((label, i) => {
              const cx = x0 + 280 + i * 60;
              if (i === (p.pm ? 1 : 0)) slip(ctx, 'slip-1', cx - 24, 438, 48, 30, '#f8f3e6', 0.9);
              text(ctx, label, cx, 454, `${i === (p.pm ? 1 : 0) ? 600 : 500} 15px ${BODY}`);
            });
          } else text(ctx, '(24 hours: 00 … 23)', x0 + 300, 454, `italic 14px ${BODY}`, SOFT);
          text(ctx, 'Done', x0 + 360, 492, `16px ${BODY}`);
          ctx.textAlign = 'left';
        };
        column(30, 'en-US', 0);
        column(470, 'en-GB', 1);
      },
    },
  ],
};

export default section;
