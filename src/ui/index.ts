import '@fontsource/shippori-mincho/latin-400.css';
import '@fontsource/shippori-mincho/latin-500.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-ext-400.css';
import '@fontsource/cormorant-garamond/latin-ext-400-italic.css';
import './ui.css';
import { clampGoalMinutes } from '../core/session';
import type { TipId } from '../core/tips';
import type { UIContext } from './context';
import { h } from './dom';
import { createGardenData } from './garden-data';
import { createHerbarium } from './herbarium';
import { createHints } from './hints';
import { createMenu } from './menu';
import { installPaper } from './paper';
import { createPlacement } from './placement';
import { createPlantLabels } from './plant-labels';
import { createPlantingSheet } from './planting-sheet';
import { createPreviewCache } from './previews';
import { createQuietLine } from './quiet-line';
import { createTimerPanel } from './timer-panel';
import { createTips } from './tips';
import type { PlantingDraft, UI, UIDeps, UIMode, UIState } from './types';

export type {
  AudioIntegration,
  NotificationIntegration,
  PlacementHighlight,
  PlantingDraft,
  UI,
  UIDeps,
  UIState,
  WidgetIntegration,
} from './types';
export { browserNotifications } from './notifications';
export { renderPlantPreview } from './previews';

/**
 * The DOM UI over the garden canvas: timer panel, planting sheet (task · time · plan · plant),
 * placement markers, corner menu (sound, floating timer, pressed flowers, garden data, hints),
 * tooltips, the quiet line (completion, fauna arrivals) and finished-plant labels.
 * The session controller is the only API it drives. See docs/systems/ui.md.
 */
export function createUI(deps: UIDeps): UI {
  const { root, controller, store, bus } = deps;
  installPaper();
  root.classList.add('ui-root');

  let timeScale = deps.timeScale ?? 1;
  let mode: UIMode = 'garden';
  const openers = new Map<HTMLDialogElement, HTMLElement | null>();
  const closing = new Map<HTMLDialogElement, ReturnType<typeof setTimeout>>();
  const live = h('div.visually-hidden.ui-live', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  let liveTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

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
      panel.el.inert = next === 'placement';
      menu.el.inert = next === 'placement';
      if (next !== 'garden') labels.hide();
      ctx.changed();
      if (next === 'garden') line.check();
    },
    changed: () => tips.schedule(),
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
  }

  // ── components ────────────────────────────────────────────────────────────────────────
  const panel = createTimerPanel(ctx, { plant: (opener) => openPlanting(opener) });

  const planting = createPlantingSheet(ctx, draft, {
    chooseSpot: () => {
      if (!draft.speciesId) return;
      ctx.setMode('placement'); // before closing, so the sheet's close handler keeps this mode
      closeNow(planting.el);
      placement.open();
    },
  });

  const placement = createPlacement(ctx, draft, {
    begin: () => begin(),
    back: () => {
      placement.close();
      openPlanting(panel.el.querySelector('.plant-session'));
    },
  });

  const herbarium = createHerbarium(ctx);
  const data = createGardenData(ctx);
  const hints = createHints(ctx);
  const menu = createMenu(ctx, {
    openHerbarium: (b) => herbarium.open(b),
    openData: (b) => data.open(b),
    openHints: (b) => hints.open(b),
  });
  const line = createQuietLine(ctx);
  const labels = createPlantLabels(ctx, document.querySelector<HTMLElement>('#garden'));

  const resolveAnchor = (anchor: string, id: TipId): HTMLElement | null => {
    if (anchor === 'garden') return id === 'swap' ? placement.firstSwapMarker() : placement.isOpen() ? placement.bar : null;
    return root.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`);
  };
  const tips = createTips(ctx, {
    tipContext: () => ({
      now: deps.clock.now(),
      widgetSupported: !!deps.widget?.supported,
      swapAvailable: placement.isOpen() ? placement.firstSwapMarker() !== null : undefined,
    }),
    resolve: resolveAnchor,
  });

  root.append(line.el, labels.el, placement.layer, panel.el, menu.el, placement.bar, tips.el, live, planting.el, herbarium.el, data.el, hints.el);
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
  function openPlanting(opener?: HTMLElement | null): void {
    if (controller.status().phase !== 'idle') return;
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
    const name = deps.getSpecies(draft.speciesId)?.name ?? 'Your seedling';
    placement.close();
    ctx.setMode('garden');
    ctx.announce(`${name} is planted. Session started: ${draft.goalMinutes} minutes.`);
    // next time starts fresh, but remembers the time and plan
    draft.taskName = '';
    draft.speciesId = null;
    draft.slotId = null;
    // keyboard users land on the running session's first control, not on <body>
    panel.render();
    panel.el.querySelector<HTMLElement>('.pause')?.focus({ preventScroll: true });
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
    if (controller.status().phase !== 'idle' && mode !== 'garden') {
      // a session started elsewhere (widget, dev tools, import): step out of planting
      if (planting.isOpen()) closeNow(planting.el);
      placement.close();
      ctx.setMode('garden');
    }
    panel.render();
    menu.render();
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
    if (panel.view() !== before) ctx.changed();
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
    confirm: panel.confirm(),
    resting: panel.resting(),
    dialogs: ctx.openDialogs(),
    tips: tips.visible(),
    markers: placement.isOpen() ? placement.markers() : [],
    line: line.current(),
    plantLabel: labels.current(),
    draft: { ...draft },
  });

  return {
    placement: placement.highlight,
    state,
    refresh: () => refresh(),
    setTimeScale(scale) {
      timeScale = Math.max(0, scale);
    },
    showPlantLabel: (p) => labels.showAt(p),
    dispose() {
      disposed = true;
      offStore();
      offTick();
      offComplete();
      window.removeEventListener('pointerdown', unlockOnGesture, true);
      window.removeEventListener('keydown', unlockOnGesture, true);
      panel.dispose();
      placement.dispose();
      menu.dispose();
      tips.dispose();
      line.dispose();
      labels.dispose();
      root.replaceChildren();
    },
  };
}
