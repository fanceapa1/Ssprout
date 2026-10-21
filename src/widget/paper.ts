import { createRng } from '../core/rng';
import { PIGMENT, rgba, wobble, type Ctx, type P } from './brush';

/** Paint washi paper: warm ground, mottling, fibres, grain, a deckled darker edge, vignette. */
export function paintPaper(ctx: Ctx, w: number, h: number, seed: string | number = 'washi'): void {
  const rng = createRng(`paper:${seed}`);
  ctx.save();
  ctx.fillStyle = PIGMENT.paper;
  ctx.fillRect(0, 0, w, h);

  // mottling: large soft blotches, barely there
  const m = rng.fork('mottle');
  for (let i = 0; i < 16; i++) {
    const x = m.range(0, w);
    const y = m.range(0, h);
    const r = m.range(30, 110);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = m.chance(0.55) ? PIGMENT.paperDeep : '#fbf6ea';
    g.addColorStop(0, rgba(tone, m.range(0.18, 0.32)));
    g.addColorStop(1, rgba(tone, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // fibres: short curved hairs, light and dark
  const f = rng.fork('fibres');
  const fibres = Math.round((w * h) / 380);
  ctx.lineCap = 'round';
  for (let i = 0; i < fibres; i++) {
    const x = f.range(-10, w + 10);
    const y = f.range(-10, h + 10);
    const len = f.range(5, 20);
    const a = f.range(0, Math.PI * 2);
    const bend = f.range(-4, 4);
    ctx.strokeStyle = f.chance(0.6) ? `rgba(170,150,110,${f.range(0.05, 0.12)})` : `rgba(255,252,243,${f.range(0.2, 0.4)})`;
    ctx.lineWidth = f.range(0.35, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend,
      y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len,
    );
    ctx.stroke();
  }

  // grain
  const gr = rng.fork('grain');
  const dots = Math.round((w * h) / 30);
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = `rgba(120,100,70,${gr.range(0.025, 0.07)})`;
    const s = gr.range(0.5, 1.1);
    ctx.fillRect(gr.range(0, w), gr.range(0, h), s, s);
  }

  // deckled edge: an irregular, darker rim where the slip was torn
  const e = rng.fork('edge');
  ctx.globalCompositeOperation = 'multiply';
  const ring = (inset: number, amp: number): P[] => {
    const pts: P[] = [];
    const per = 2 * (w + h);
    const nz = wobble(e);
    for (let d = 0; d < per; d += 4) {
      const j = inset + amp * (0.5 + 0.5 * nz(d * 0.03)) * 1.4 + e.range(0, amp * 0.5);
      if (d < w) pts.push({ x: d, y: j });
      else if (d < w + h) pts.push({ x: w - j, y: d - w });
      else if (d < 2 * w + h) pts.push({ x: w - (d - w - h), y: h - j });
      else pts.push({ x: j, y: h - (d - 2 * w - h) });
    }
    return pts;
  };
  for (let k = 0; k < 4; k++) {
    const inner = ring(1 + k * 2.2, 3 + k * 1.5);
    ctx.fillStyle = `rgba(185,165,125,${0.06 - k * 0.012})`;
    ctx.beginPath();
    ctx.rect(-2, -2, w + 4, h + 4);
    inner.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill('evenodd');
  }
  // gentle vignette: edges dissolve
  const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(1, 'rgba(200,180,140,0.16)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
