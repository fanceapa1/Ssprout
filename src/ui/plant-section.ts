import { WATERING_SECONDS } from '../plants/watering';
import type { PlantInstance } from '../core/state';
import { createRng } from '../core/rng';
import { createPainter, mix, PIGMENTS } from '../paint';
import { renderPlantView } from '../plants/view';
import type { UIContext } from './context';
import { h, setText } from './dom';
import { formatDay, inSentence } from './format';
import { renderPlantPreview } from './previews';

/**
 * "Your plant" (ADR 0134): a large live painting of the session's plant, in the dock. It grows
 * with the session (the same `renderPlantView` and growth steps as the floating widget and the
 * garden), plays the watering animation whenever the plant is watered (`session:water` on the bus,
 * or `water()` — the hook the automatic focus watering will call), and wilts away if the session
 * is ended. Idle, it quietly shows the most recent bloom with its task, or an empty bed waiting
 * for a first session. No guilt, no counts.
 */
export type PlantViewMode = 'growing' | 'bloom' | 'empty';

export interface PlantViewState {
  mode: PlantViewMode;
  speciesId: string | null;
  growth: number;
  /** the watering animation is playing */
  watering: boolean;
  /** the cancelled seedling is wilting away */
  wilting: boolean;
}

export interface PlantSection {
  mount(body: HTMLElement): () => void;
  /** re-read the session and repaint (the controller ticks once a second) */
  render(): void;
  /** play the watering animation; false when there is no plant or it is already pouring */
  water(): boolean;
  state(): PlantViewState;
}

const WATER_MS = WATERING_SECONDS * 1000;
const WILT_MS = 3000;
const MAX_DPR = 2;

/** An empty bed: a soft mound of earth and one seed, waiting (studio + idle view). */
export function paintEmptyBed(canvas: HTMLCanvasElement, seed = 1): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width;
  const H = canvas.height;
  const p = createPainter(canvas, { seed: `bed-${seed}` });
  const rng = createRng(`bed-${seed}`);
  const cy = H * 0.84;
  p.wash({ cx: W / 2, cy, rx: W * 0.36, ry: H * 0.07 }, mix(PIGMENTS.stoneWarm, PIGMENTS.wood, 0.35), {
    rng,
    opacity: 0.4,
    edge: 0.35,
    centreLift: 0.25,
    deform: 0.4,
    granulation: 0.5,
    fade: { angle: -Math.PI / 2, start: 0.25, amount: 0.7, ragged: 0.6 },
  });
  p.wash({ cx: W * 0.47, cy: cy + H * 0.012, rx: W * 0.2, ry: H * 0.03 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.25), { rng, opacity: 0.28, edge: 0.3, deform: 0.5 });
  // a few blades at the rim, and the seed resting on top
  for (let i = 0; i < 5; i++) {
    const x = W * (0.24 + rng.next() * 0.52);
    p.grassTuft({ x, y: cy + rng.range(-2, 4) * (H / 300) }, { rng, height: H * rng.range(0.04, 0.07), blades: rng.int(3, 5), ground: false, opacity: 0.7 });
  }
  p.dab({ x: W * 0.52, y: cy - H * 0.03 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.4), { rng, length: Math.max(4, W * 0.03), width: Math.max(3, W * 0.02), angle: -1.1, variant: 'round' });
}

/**
 * The plant's backdrop: a pale round wash like a marumado (a garden's round window), lost at
 * its lower edge where the ground is, so the plant has a place to stand in. Static per size.
 *
 * Painted as one round puddle of thin celadon (ADR 0184): many layers that barely wander from the
 * circle, so the outline stays round while its edge is soft and alive; pigment pooled in a fine
 * darker rim and lifted from the heart; a whisper of sky-blue let into it wet-in-wet near the top;
 * the bottom lost into the paper where the ground is. (The first version wandered so much it read
 * as a lumpy blob, with an off-centre inner wash making a second, lumpier ring.)
 */
export function paintRoundWindow(canvas: HTMLCanvasElement, seed = 1): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width;
  const H = canvas.height;
  const p = createPainter(canvas, { seed: `window-${seed}` });
  const rng = createRng(`window-${seed}`);
  const r = Math.min(W, H) * 0.41;
  const cx = W / 2;
  // a little low, so the ground the plant stands on sits in its lost lower edge
  const cy = H * 0.55;
  const rim = Math.max(1.5, r * 0.02);
  // a hand-made circle: two slow harmonics of under 1.5 % keep it from looking compass-drawn
  const a1 = rng.range(0, Math.PI * 2);
  const a2 = rng.range(0, Math.PI * 2);
  const circle = Array.from({ length: 96 }, (_, i) => {
    const t = (i / 96) * Math.PI * 2;
    const k = 1 + 0.009 * Math.sin(2 * t + a1) + 0.006 * Math.sin(3 * t + a2);
    return { x: cx + Math.cos(t) * r * k, y: cy + Math.sin(t) * r * k * 0.985 };
  });
  // cool sky-blue at the top bleeding into celadon-sage below, in one wet puddle (no inner edge)
  p.wetInWet(circle, mix(PIGMENTS.cerulean, PIGMENTS.celadon, 0.6), mix(PIGMENTS.celadon, PIGMENTS.sageLight, 0.45), {
    rng,
    angle: Math.PI / 2,
    split: 0.4,
    softness: 0.6,
    fingers: 0.35,
    layers: 22,
    deform: 0.004,
    spread: 0.014,
    coverage: 0.95,
    opacity: 0.3,
    edge: 0.6,
    edgeWidth: rim,
    sharpness: 0.32,
    centreLift: 0.42,
    granulation: 0.3,
    flow: 0.25,
    flowScale: r * 0.5,
    fade: { angle: Math.PI / 2, start: 0.5, amount: 1, ragged: 0.3 },
  });
}

export function createPlantSection(ctx: UIContext): PlantSection {
  const { controller, store, bus, getSpecies, reducedMotion } = ctx.deps;
  const canvas = h('canvas.plant-canvas', { role: 'img' });
  const backdrop = h('canvas.plant-backdrop', { 'aria-hidden': 'true' });
  let backdropKey = '';
  const name = h('span.plant-view-name');
  const native = h('span.plant-view-native');
  const task = h('p.plant-view-task');
  const stage = h('p.plant-view-stage');
  const caption = h('div.plant-view-caption', {}, h('p.plant-view-title', {}, name, native), task, stage);
  const root = h('div.plant-view', { 'data-mode': 'empty' }, h('div.plant-frame', {}, backdrop, canvas), caption);

  let mode: PlantViewMode = 'empty';
  /** the session shown (the active one), or null */
  let sessionId: string | null = null;
  let speciesId: string | null = null;
  let seed = 1;
  let growth = 0;
  let wateringStart: number | null = null;
  let wilt: { start: number; speciesId: string; seed: number; growth: number } | null = null;
  let raf: number | null = null;
  let lastPaintKey = '';
  let mounted = false;

  const lastBloom = (): PlantInstance | null => {
    let best: PlantInstance | null = null;
    for (const p of store.get().plants) if (!best || p.completedAt > best.completedAt) best = p;
    return best;
  };

  const stageWord = (g: number) => (g < 0.08 ? 'A seed, just planted' : g < 0.35 ? 'A seedling, growing' : g < 0.7 ? 'Growing steadily' : g < 0.97 ? 'In bud' : 'About to bloom');

  function sizeCanvas(): boolean {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width);
    const hgt = Math.round(r.height);
    if (w < 2 || hgt < 2) return false;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const pw = Math.round(w * dpr);
    const ph = Math.round(hgt * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
      lastPaintKey = '';
    }
    const bk = `${pw}x${ph}`;
    if (bk !== backdropKey) {
      backdropKey = bk;
      backdrop.width = pw;
      backdrop.height = ph;
      paintRoundWindow(backdrop, 1);
    }
    return true;
  }

  function paint(now: number): void {
    if (!mounted || !sizeCanvas()) return;
    const watering = wateringStart === null ? null : Math.min(1, (now - wateringStart) / WATER_MS);
    const wilting = wilt ? Math.min(1, (now - wilt.start) / WILT_MS) : null;
    const key = `${mode}|${speciesId}|${seed}|${growth.toFixed(4)}|${watering ?? '-'}|${wilting ?? '-'}|${canvas.width}x${canvas.height}`;
    if (key === lastPaintKey) return;
    lastPaintKey = key;
    if (wilt && wilting !== null) {
      renderPlantView(canvas, { speciesId: wilt.speciesId, seed: wilt.seed, growth: wilt.growth, watering: null, wilt: wilting, framing: 'growth' });
      return;
    }
    if (mode === 'empty' || !speciesId) {
      paintEmptyBed(canvas, 1);
      return;
    }
    // framed on what has grown, so a just-planted seed fills the window instead of a speck (devlog 25)
    const ok = renderPlantView(canvas, { speciesId, seed, growth, watering, framing: 'growth' });
    if (!ok) {
      const def = getSpecies(speciesId);
      if (def) renderPlantPreview(canvas, def, seed, growth);
    }
  }

  function loop(now: number): void {
    raf = null;
    if (wateringStart !== null && now - wateringStart >= WATER_MS) {
      wateringStart = null;
      lastPaintKey = '';
      ctx.changed();
    }
    if (wilt && now - wilt.start >= WILT_MS) {
      wilt = null;
      lastPaintKey = '';
      update();
      ctx.changed();
    }
    paint(now);
    if (wateringStart !== null || wilt) raf = requestAnimationFrame(loop);
  }

  const animate = () => {
    raf ??= requestAnimationFrame(loop);
  };

  /** Re-read what to show. */
  function update(): void {
    const st = controller.status();
    const s = st.session;
    if (s && st.timeline) {
      mode = 'growing';
      if (sessionId !== s.id && wateringStart !== null) wateringStart = null; // switched plants
      sessionId = s.id;
      speciesId = s.speciesId;
      seed = s.seed;
      growth = st.timeline.growth;
    } else {
      sessionId = null;
      const last = lastBloom();
      mode = last ? 'bloom' : 'empty';
      speciesId = last?.speciesId ?? null;
      seed = last?.seed ?? 1;
      growth = last ? 1 : 0;
      if (!last && wateringStart !== null) wateringStart = null;
    }
    root.dataset.mode = wilt ? 'wilting' : mode;
    if (speciesId) root.dataset.speciesId = speciesId;
    else delete root.dataset.speciesId;
    const def = speciesId ? getSpecies(speciesId) : undefined;
    if (wilt) {
      const w = getSpecies(wilt.speciesId);
      setText(name, w?.name ?? 'Your seedling');
      setText(native, '');
      setText(task, 'It won’t bloom this time. That’s all right.');
      setText(stage, '');
      canvas.setAttribute('aria-label', `${w?.name ?? 'The seedling'}, letting go`);
    } else if (mode === 'growing' && s) {
      setText(name, def?.name ?? 'Your seedling');
      setText(native, def?.nativeName ?? '');
      setText(task, `for “${s.taskName}”`);
      setText(stage, wateringStart !== null ? 'Drinking it in' : stageWord(growth));
      canvas.setAttribute('aria-label', `Your ${inSentence(def?.name ?? 'seedling')}, ${Math.round(growth * 100)} percent grown`);
    } else if (mode === 'bloom') {
      const last = lastBloom()!;
      setText(name, def?.name ?? 'Your plant');
      setText(native, def?.nativeName ?? '');
      setText(task, `${last.taskName?.trim() ? `“${last.taskName.trim()}” · ` : ''}${last.sessionMinutes} min · ${formatDay(last.plantedAt)}`);
      setText(stage, 'Your latest bloom');
      canvas.setAttribute('aria-label', `Your latest bloom: ${def?.name ?? 'a plant'}`);
    } else {
      setText(name, 'An empty bed');
      setText(native, '');
      setText(task, 'Waiting for its first seed.');
      setText(stage, '');
      canvas.setAttribute('aria-label', 'An empty bed, waiting for a seed');
    }
  }

  function render(): void {
    update();
    paint(performance.now());
  }

  function water(): boolean {
    if (!speciesId || mode === 'empty' || wilt) return false;
    if (reducedMotion) return false; // like the widget: no animation under reduced motion
    if (wateringStart !== null) return false;
    wateringStart = performance.now();
    update();
    animate();
    ctx.changed();
    return true;
  }

  // the shown (active) session's plant only: another session's events are not about this plant
  const offWater = bus.on('session:water', (e) => {
    update();
    if (!e.sessionId || e.sessionId === sessionId) void water();
  });
  const offCancel = bus.on('session:cancel', (e) => {
    if (mode !== 'growing' || !speciesId || e.sessionId !== sessionId) return;
    if (reducedMotion) return;
    wateringStart = null;
    wilt = { start: performance.now(), speciesId, seed, growth };
    update();
    animate();
  });

  return {
    mount(body) {
      body.append(root);
      mounted = true;
      const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => paint(performance.now()));
      ro?.observe(canvas);
      render();
      return () => {
        mounted = false;
        ro?.disconnect();
        offWater();
        offCancel();
        if (raf !== null) cancelAnimationFrame(raf);
        raf = null;
      };
    },
    render,
    water,
    state: () => ({ mode, speciesId, growth, watering: wateringStart !== null, wilting: wilt !== null }),
  };
}
