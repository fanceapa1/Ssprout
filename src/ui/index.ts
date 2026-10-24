import '@fontsource/shippori-mincho/latin-400.css';
import '@fontsource/shippori-mincho/latin-500.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-ext-400.css';
import '@fontsource/cormorant-garamond/latin-ext-400-italic.css';
import '@fontsource/cormorant-garamond/latin-ext-500.css';
import '@fontsource/cormorant-garamond/latin-ext-500-italic.css';
import './ui.css';
import { startPrefill, type OccurrenceView, type StartPrefill } from '../core/schedule';
import { clampGoalMinutes } from '../core/session';
import type { TipId } from '../core/tips';
import type { UIContext } from './context';
import { createCalendar, type Calendar } from './calendar';
import { createDock } from './dock';
import { guideLines } from './dock-guide';
import { h } from './dom';
import { createGardenData } from './garden-data';
import { createHerbarium } from './herbarium';
import { createHints } from './hints';
import { installPagePaper } from './page-paper';
import { installPaper } from './paper';
import { createPill } from './pill';
import { createPlacement } from './placement';
import { createPlantCard } from './plant-card';
import { createPlantLabels } from './plant-labels';
import { createPlantSection } from './plant-section';
import { applyPrefill, clearPrefill, createPlantingSheet } from './planting-sheet';
import { createPreviewCache } from './previews';
import { createQuietLine } from './quiet-line';
import { createDueCards, type DueCards } from './schedule-card';
import { createScheduleSheet, type ScheduleSheet } from './schedule-sheet';
import { createScrollbar } from './scrollbar';
import { createSessionList } from './session-list';
import { createSmoothScroll } from './smooth-scroll';
import { createSoundMixer } from './sound-mixer';
import './sound-mixer.css';
import { createStage } from './stage';
import { createStageCamera } from './stage-camera';
import { createTimerPanel } from './timer-panel';
import { createTips } from './tips';
import { createTools } from './tools';
import { createWayfinding } from './wayfinding';
import type { PlantingDraft, UI, UIDeps, UIMode, UIState } from './types';
// last, so the one hover language (ADR 0204) sits over every component's own styles
import './hover.css';

export type { Dock, DockSection, DockSectionDef, DockSectionInfo, DockSpan } from './dock';
export type {
  AudioIntegration,
  NotificationIntegration,
  PlacementHighlight,
  PlantingDraft,
  UI,
  UIDeps,
  UIScroll,
  UIStage,
  UIState,
  WidgetIntegration,
} from './types';
export { browserNotifications } from './notifications';
export { renderPlantPreview } from './previews';

/**
 * The app page around the garden (ADR 0130): the garden stage at the top (canvas + what sits on
 * the painting: timer pill, corner tool icons, quiet line, placement markers, plant labels), the
 * dock of sections below it (session controls, your plant, the calendar, garden tools),
 * the planting sheet and other sheets, tooltips, custom smooth scrolling and scrollbar.
 * The session controller is the only API it drives. See docs/systems/ui.md.
 */
export function createUI(deps: UIDeps): UI {
  const { root, controller, store, bus } = deps;
  installPaper();
  root.classList.add('ui-root');
  // the page's paper: the garden's own washi, generated once the first frames are out of the way
  const whenIdle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  whenIdle(() => installPagePaper());

  const stageEl =
    deps.stage ??
    root.querySelector<HTMLElement>('.stage') ??
    (() => {
      const el = h('section.stage', { 'aria-label': 'Your garden' });
      root.prepend(el);
      return el;
    })();
  const stage = createStage(stageEl, stageEl.querySelector<HTMLCanvasElement>('canvas'));
  const scroller = createSmoothScroll({ reducedMotion: deps.reducedMotion });
  const dock = createDock({ label: 'Study tools' });

  let timeScale = deps.timeScale ?? 1;
  let mode: UIMode = 'garden';
  const openers = new Map<HTMLDialogElement, HTMLElement | null>();
  const closing = new Map<HTMLDialogElement, ReturnType<typeof setTimeout>>();
  const live = h('div.visually-hidden.ui-live', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  let liveTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let guideQueued = false;

  const draft: PlantingDraft = {
    taskName: '',
    goalMinutes: clampGoalMinutes(store.get().settings.lastGoalMinutes),
    planId: null,
    speciesId: null,
    slotId: null,
  };

  const allDialogs = (): HTMLDialogElement[] => [...root.querySelectorAll<HTMLDialogElement>('dialog[data-dialog]')];

  const ctx: UIContext = {
    deps,
    previews: createPreviewCache(deps.getSpecies),
    announce(text) {
      live.textContent = '';
      if (liveTimer !== null) clearTimeout(liveTimer);
      liveTimer = setTimeout(() => (live.textContent = text), 40);
    },
    mode: () => mode,
    setMode(next) {
      if (mode === next) return;
      mode = next;
      root.dataset.mode = next;
      // the rest of the UI steps back while the gardener chooses a spot
      dock.el.inert = next === 'placement';
      tools.corner.inert = next === 'placement';
      syncPillInert();
      if (next !== 'garden') {
        labels.hide();
        plantCard?.close({ restoreFocus: false });
      }
      ctx.changed();
      if (next === 'garden') line.check();
    },
    changed: () => {
      tips.schedule();
      queueGuide();
    },
    delay: (ms) => Math.max(0, ms * timeScale),
    openDialog(dialog, opener) {
      for (const d of allDialogs()) if (d !== dialog && d.open) closeNow(d);
      const t = closing.get(dialog);
      if (t !== undefined) {
        clearTimeout(t);
        closing.delete(dialog);
        dialog.classList.remove('is-closing');
      }
      if (!dialog.open) {
        openers.set(dialog, opener ?? (document.activeElement as HTMLElement | null));
        dialog.showModal();
      }
      syncSheetLock();
      ctx.changed();
    },
    closeDialog(dialog) {
      if (!dialog.open || closing.has(dialog)) return;
      if (deps.reducedMotion) return closeNow(dialog);
      dialog.classList.add('is-closing');
      closing.set(
        dialog,
        setTimeout(() => closeNow(dialog), 360),
      );
      syncSheetLock();
      ctx.changed();
    },
    openDialogs: () => allDialogs().filter((d) => d.open && !closing.has(d)).map((d) => d.dataset.dialog!),
  };

  function closeNow(dialog: HTMLDialogElement): void {
    const t = closing.get(dialog);
    if (t !== undefined) clearTimeout(t);
    closing.delete(dialog);
    dialog.classList.remove('is-closing');
    if (dialog.open) dialog.close();
    syncSheetLock();
  }

  /**
   * The page does not scroll under an open sheet (ADR 0190): `html.has-sheet` hides its overflow
   * while a sheet is open and not fading out. A class set here rather than an `html:has(…)` rule,
   * which would re-match the root on every change inside the page.
   */
  function syncSheetLock(): void {
    const open = allDialogs().some((d) => d.open && !closing.has(d));
    document.documentElement.classList.toggle('has-sheet', open);
  }
  // a sheet closed natively (Esc) also unlocks the page
  root.addEventListener('close', () => syncSheetLock(), true);

  // ── components ────────────────────────────────────────────────────────────────────────
  // a planned session waiting with Start is the Study section's one primary action (ADR 0201)
  let dueCards: DueCards | null = null;
  const dueWaiting = () => dueCards?.state().mode === 'start';
  const panel = createTimerPanel(ctx, { plant: (opener) => openPlanting(opener), dueWaiting });
  const sessions = createSessionList(ctx, { plantAnother: (opener) => openPlanting(opener), dueWaiting });
  const pill = createPill(ctx, {
    start: (opener) => openPlanting(opener),
    jump: () => void jumpToControls(),
  });
  const plantView = createPlantSection(ctx);

  const planting = createPlantingSheet(ctx, draft, {
    chooseSpot: () => {
      if (!draft.speciesId) return;
      ctx.setMode('placement'); // before closing, so the sheet's close handler keeps this mode
      closeNow(planting.el);
      placement.open();
      // the garden is the map: bring the whole stage into view
      void scroller.scrollTo(0);
    },
  });

  // the sheet's previews are painted ahead in a worker (ADR 0222): after the garden's first
  // paint, on an idle moment, and again when a Start control is pointed at or focused
  const warmPreviews = () => {
    if (!disposed) planting.prewarm();
  };
  void deps.whenGardenReady?.().then(() => whenIdle(warmPreviews));
  const warmOnIntent = (e: Event) => {
    if (e.target instanceof Element && e.target.closest('[data-anchor="start"], .plant-another')) warmPreviews();
  };
  root.addEventListener('pointerover', warmOnIntent);
  root.addEventListener('focusin', warmOnIntent);

  const placement = createPlacement(ctx, draft, {
    begin: () => begin(),
    back: () => {
      placement.close();
      openPlanting(lastOpener?.isConnected ? lastOpener : pill.el.querySelector<HTMLElement>('.pill-start'));
    },
  });

  const herbarium = createHerbarium(ctx);
  const data = createGardenData(ctx);
  const hints = createHints(ctx);
  const soundMixer = createSoundMixer(ctx);
  const tools = createTools(ctx, {
    openSoundscape: (b) => soundMixer.open(b),
    openHerbarium: (b) => herbarium.open(b),
    openData: (b) => data.open(b),
    openHints: (b) => hints.open(b),
  });
  const line = createQuietLine(ctx);
  const labels = createPlantLabels(ctx, stage.canvas);
  // the camera: zoom controls and gestures, focus on the growing plant, plant cards (ADRs 0162–0168)
  const plantCard = deps.camera ? createPlantCard(ctx) : null;
  const stageCamera =
    deps.camera && plantCard ? createStageCamera(ctx, { stage, integration: deps.camera, card: plantCard, labels, placement: placement.highlight }) : null;

  // ── the dock: features plug in as sections (docs/ARCHITECTURE.md › Dock) ──────────────────
  // the session controls, then the sessions in progress (ADR 0156)
  dock.addSection({ id: 'session', title: 'Study', order: 10, mount: (body) => void body.append(panel.el, sessions.el) });
  dock.addSection({ id: 'plant', title: 'Your plant', order: 20, mount: (body) => plantView.mount(body) });
  // filled below when the app has a scheduler (ADR 0175); hidden until then (ADR 0130)
  dock.addSection({ id: 'calendar', title: 'Calendar', order: 30, span: 'full', backdrop: 'firm' });
  dock.addSection({ id: 'tools', title: 'Garden tools', order: 90, span: 'full', mount: (body) => void body.append(tools.dock) });

  // ── scheduled sessions: the calendar, its editor, the waiting card (ADRs 0173–0177) ─────────
  let calendar: Calendar | null = null;
  let scheduleSheet: ScheduleSheet | null = null;
  const offSchedules: Array<() => void> = [];
  if (deps.schedules) {
    const scheduler = deps.schedules;
    const startFrom = (o: OccurrenceView, opener: HTMLElement | null) => openPlanting(opener, startPrefill(o));
    scheduleSheet = createScheduleSheet(ctx, { scheduler, startNow: startFrom });
    const sheet = scheduleSheet;
    calendar = createCalendar(ctx, {
      scheduler,
      edit: (target, opener) => ('occurrence' in target ? sheet.openEdit(target.occurrence, opener) : sheet.openNew(target, opener)),
    });
    const cal = calendar;
    dock.fill('calendar', (body) => {
      body.append(cal.el);
      return () => cal.dispose();
    });
    dueCards = createDueCards(ctx, { scheduler, start: startFrom, showSessions: (opener) => openPlanting(opener) });
    dock.get('session')?.body.prepend(dueCards.el);
    const cards = dueCards;
    offSchedules.push(
      scheduler.onChange(() => {
        cards.render();
        cal.render();
      }),
    );
  }

  // ── the pill steps aside while the dock's Study controls are on screen (ADR 0203) ──────────
  let pillAside = false;
  function syncPillInert(): void {
    pill.el.inert = mode === 'placement' || pillAside;
    if (dueCards) dueCards.slip.inert = pillAside;
  }
  const asideObserver =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            const on = entries.some((e) => e.isIntersecting);
            if (on === pillAside) return;
            pillAside = on;
            root.classList.toggle('pill-aside', on);
            syncPillInert();
            ctx.changed();
          },
          // the controls count as on screen once they are clear of the window's lower edge
          { rootMargin: '0px 0px -12% 0px' },
        )
      : null;
  /** The observer's answer for the page scrolled to `y`, at once (the observer agrees once it gets there). */
  function settleAside(y: number): void {
    const body = dock.get('session')?.body;
    if (!body || !asideObserver) return;
    const r = body.getBoundingClientRect();
    const shift = window.scrollY - y;
    const on = r.top + shift < window.innerHeight * 0.88 && r.bottom + shift > 0;
    if (on === pillAside) return;
    pillAside = on;
    root.classList.toggle('pill-aside', on);
    syncPillInert();
    ctx.changed();
  }

  // ── guidance: a helper line under each heading, following the state (ADR 0201) ─────────────
  function queueGuide(): void {
    if (guideQueued) return;
    guideQueued = true;
    queueMicrotask(syncGuide);
  }
  function syncGuide(): void {
    guideQueued = false;
    if (disposed) return;
    const st = controller.status();
    const view = calendar?.el.dataset.view;
    const lines = guideLines({
      panel: panel.view(),
      confirming: panel.confirm() !== null,
      due: dueCards?.state().mode ?? null,
      sessions: st.sessions.length,
      watered: !!st.timeline?.watered,
      plant: plantView.state().mode,
      calendar: view === 'day' || view === 'week' || view === 'month' ? view : null,
    });
    dock.get('session')?.setHelper(lines.session);
    dock.get('plant')?.setHelper(lines.plant);
    dock.get('calendar')?.setHelper(lines.calendar);
    dock.get('tools')?.setHelper(lines.tools);
  }

  const studyBody = dock.get('session')?.body;
  if (studyBody) asideObserver?.observe(studyBody);
  const scrollbar = createScrollbar(scroller, { delay: (ms) => ctx.delay(ms) });
  const offDock = dock.onChange(() => scrollbar.update());

  /** Glide down to the session controls and put focus on the most useful one. */
  async function jumpToControls(): Promise<void> {
    const section = dock.get('session');
    if (!section) return;
    const target = sessions.focusTarget() ?? panel.focusTarget();
    await scroller.scrollToElement(section.el, { offset: 24 });
    (target ?? section.heading).focus({ preventScroll: true });
  }

  // one control can live in two places (the pill and the dock, the corner and the dock): tips go
  // to the dock's copy when it is in view (its new home), else to the one on the garden
  const resolveAnchor = (anchor: string, id: TipId): HTMLElement | HTMLElement[] | null => {
    if (anchor === 'garden') return id === 'swap' ? placement.firstSwapMarker() : placement.isOpen() ? placement.bar : null;
    const all = [...root.querySelectorAll<HTMLElement>(`[data-anchor="${anchor}"]`)];
    return [...all.filter((a) => dock.el.contains(a)), ...all.filter((a) => !dock.el.contains(a))];
  };
  const tips = createTips(ctx, {
    tipContext: () => ({
      now: deps.clock.now(),
      widgetSupported: !!deps.widget?.supported,
      swapAvailable: placement.isOpen() ? placement.firstSwapMarker() !== null : undefined,
    }),
    resolve: resolveAnchor,
  });

  stage.layer.append(line.el, labels.el, placement.layer, pill.el, tools.corner, placement.bar);
  if (dueCards) stage.layer.append(dueCards.slip);
  if (stageCamera && plantCard) stage.layer.append(stageCamera.controls, plantCard.el);
  stageEl.after(dock.el);
  // the guiding path from the garden's stepping stones through the sections (ADR 0202)
  const wayfinding = createWayfinding({ dock, stage: stageEl, viewport: () => deps.viewport(), reducedMotion: deps.reducedMotion });
  root.append(tips.el, scrollbar.el, live, planting.el, herbarium.el, data.el, hints.el, soundMixer.el);
  if (scheduleSheet) root.append(scheduleSheet.el);
  root.dataset.mode = mode;
  for (const d of allDialogs()) {
    d.addEventListener('close', () => {
      if (d === planting.el && mode === 'planting') ctx.setMode('garden');
      const opener = openers.get(d);
      openers.delete(d);
      if (opener?.isConnected && !opener.closest('[inert]') && ctx.openDialogs().length === 0 && mode === 'garden') {
        opener.focus({ preventScroll: true });
      }
      ctx.changed();
      if (mode === 'garden') line.check();
    });
  }

  // ── flows ─────────────────────────────────────────────────────────────────────────────
  let lastOpener: HTMLElement | null = null;
  /** the active session when the planting sheet opened (another session may be running) */
  let plantingOver: string | null = null;
  /** Open the planting sheet; `prefill` from a scheduled session (the waiting card, ADR 0173). */
  function openPlanting(opener?: HTMLElement | null, prefill?: StartPrefill): void {
    const st = controller.status();
    if (!st.canStart) {
      // up to three grow at once: say so gently and offer to switch instead (ADR 0156)
      sessions.showLimit();
      if (opener && !dock.el.contains(opener)) void jumpToControls();
      return;
    }
    plantingOver = st.session?.id ?? null;
    lastOpener = opener ?? null;
    if (prefill) applyPrefill(draft, prefill, (m) => controller.recommendPlans(m));
    else clearPrefill(draft);
    ctx.setMode('planting');
    planting.open(opener);
  }

  function begin(): void {
    if (!draft.speciesId || !draft.slotId || !draft.planId) return;
    beforeStart();
    const ok = controller.start({
      taskName: draft.taskName.trim() || 'Study session',
      goalMinutes: draft.goalMinutes,
      planId: draft.planId,
      speciesId: draft.speciesId,
      slotId: draft.slotId,
    });
    if (!ok) return;
    // started from a scheduled session: link it back, so the calendar shows it done (ADR 0173)
    const startedId = store.get().session?.id;
    if (draft.link && startedId) deps.schedules?.link(draft.link, startedId);
    draft.link = null;
    const name = deps.getSpecies(draft.speciesId)?.name ?? 'Your seedling';
    placement.close();
    ctx.setMode('garden');
    ctx.announce(`${name} is planted. Session started: ${draft.goalMinutes} minutes.`);
    // next time starts fresh, but remembers the time and plan
    draft.taskName = '';
    draft.speciesId = null;
    draft.slotId = null;
    // keyboard users land on the running session's first control on the garden (the pill's
    // Pause), not on <body>; the page stays on the garden, where the seedling just appeared
    panel.render();
    pill.render();
    // the observer learns of the glide to the garden only frames later: a quick Begin found the
    // pill still aside (inert, hidden) and focus fell to <body>; settle it for where the page goes
    settleAside(scroller.state().target);
    pill.pause.focus({ preventScroll: true });
  }

  function beforeStart(): void {
    const { audio, notifications } = deps;
    if (audio && !audio.isMuted()) audio.unlock();
    // without an integration the timer surfaces ask inside `session:start` (docs/systems/widget.md)
    if (!notifications || store.get().settings.notifications !== 'unasked') return;
    if (!notifications.supported) {
      controller.updateSettings({ notifications: 'denied' });
      return;
    }
    const now = notifications.permission();
    if (now !== 'default') {
      controller.updateSettings({ notifications: now });
      return;
    }
    void notifications
      .request()
      .then((answer) => controller.updateSettings({ notifications: answer === 'granted' ? 'granted' : 'denied' }))
      .catch(() => controller.updateSettings({ notifications: 'denied' }));
  }

  // Store listeners must not call the controller synchronously (dispatches inside a delivery are
  // queued), so state changes are coalesced into one microtask refresh.
  let refreshQueued = false;
  const refresh = () => {
    refreshQueued = false;
    if (disposed) return;
    if (mode !== 'garden' && (controller.status().session?.id ?? null) !== plantingOver) {
      // a session started or switched elsewhere (widget, dev tools, import): step out of planting
      if (planting.isOpen()) closeNow(planting.el);
      placement.close();
      ctx.setMode('garden');
    }
    dueCards?.render();
    panel.render();
    sessions.render();
    pill.render();
    plantView.render();
    tools.render();
    if (soundMixer.isOpen()) soundMixer.render();
    calendar?.render();
    line.check();
    ctx.changed();
  };
  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(refresh);
  };
  const offStore = store.subscribe(queueRefresh);
  const offTick = controller.onTick(() => {
    const before = panel.view();
    panel.render();
    sessions.render();
    pill.render();
    plantView.render();
    if (panel.view() !== before) ctx.changed();
    else queueGuide();
  });
  const offComplete = bus.on('session:complete', ({ plant }) => {
    const name = deps.getSpecies(plant.speciesId)?.name ?? 'Your plant';
    const task = plant.taskName?.trim();
    const text = task ? `Your ${name} for “${task}” has bloomed.` : `Your ${name} has bloomed.`;
    line.say(text, 'complete');
    ctx.announce(text);
  });

  // Autoplay policy: wake the soundscape on the first gesture once sound is on (persisted).
  const unlockOnGesture = () => {
    const audio = deps.audio;
    if (!audio || audio.isMuted()) return;
    audio.unlock();
    window.removeEventListener('pointerdown', unlockOnGesture, true);
    window.removeEventListener('keydown', unlockOnGesture, true);
  };
  if (deps.audio) {
    window.addEventListener('pointerdown', unlockOnGesture, true);
    window.addEventListener('keydown', unlockOnGesture, true);
  }

  line.check();
  ctx.changed();

  const state = (): UIState => ({
    mode,
    panel: panel.view(),
    pill: pill.view(),
    plantView: plantView.state(),
    sessions: sessions.state(),
    pillMore: pill.more(),
    pillAside,
    confirm: panel.confirm(),
    resting: panel.resting(),
    dialogs: ctx.openDialogs(),
    tips: tips.visible(),
    markers: placement.isOpen() ? placement.markers() : [],
    line: line.current(),
    plantLabel: labels.current(),
    plantCard: plantCard?.current() ?? null,
    draft: { ...draft },
    calendar: calendar?.state() ?? null,
    due: dueCards?.state() ?? null,
    scheduleSheet: scheduleSheet?.state() ?? null,
  });

  return {
    dock,
    stage: { el: stage.el, onZoomGesture: (fn) => stage.onZoomGesture(fn) },
    scroll: {
      state: () => scroller.state(),
      to(target, opts) {
        if (typeof target === 'number') return scroller.scrollTo(target, opts);
        const section = dock.get(target);
        return section ? scroller.scrollToElement(section.el, { ...opts, offset: 24 }) : Promise.resolve();
      },
    },
    plantView: { water: () => plantView.water(), state: () => plantView.state() },
    wayfinding: { state: () => wayfinding.state(), layout: () => wayfinding.layout() },
    calendar: calendar
      ? { state: () => calendar!.state(), setView: (v) => calendar!.setView(v), go: (d) => calendar!.go(d) }
      : null,
    placement: placement.highlight,
    state,
    refresh: () => refresh(),
    previewsReady: () => planting.previewsReady(),
    setTimeScale(scale) {
      timeScale = Math.max(0, scale);
    },
    showPlantLabel: (p) => labels.showAt(p),
    camera: stageCamera
      ? {
          openCard: (id) => stageCamera.openCard(id),
          closeCard: () => plantCard?.close(),
          setAutoFocus: (on) => stageCamera.setAutoFocus(on),
          state: () => stageCamera.state(),
        }
      : null,
    dispose() {
      disposed = true;
      document.documentElement.classList.remove('has-sheet');
      offStore();
      offTick();
      offComplete();
      window.removeEventListener('pointerdown', unlockOnGesture, true);
      window.removeEventListener('keydown', unlockOnGesture, true);
      root.removeEventListener('pointerover', warmOnIntent);
      root.removeEventListener('focusin', warmOnIntent);
      panel.dispose();
      placement.dispose();
      tools.dispose();
      soundMixer.dispose();
      offDock();
      asideObserver?.disconnect();
      wayfinding.dispose();
      scrollbar.dispose();
      scroller.dispose();
      dock.dispose();
      stage.dispose();
      tips.dispose();
      line.dispose();
      labels.dispose();
      for (const off of offSchedules) off();
      stageCamera?.dispose();
      plantCard?.dispose();
      root.replaceChildren();
    },
  };
}
