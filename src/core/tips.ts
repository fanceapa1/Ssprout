import type { Action, GardenState } from './state';

/**
 * Onboarding hints (SPEC §7). A tip shows while it is relevant and not yet retired; it is retired
 * the first time the gardener uses that mechanism. Retired tips stay listed behind the ⓘ.
 */

export type TipId = 'duration' | 'widget' | 'placement' | 'swap' | 'pressed' | 'sound' | 'notifications';

/** Facts the state alone cannot tell (supplied by the UI). */
export interface TipContext {
  /** Some compatible slot for the chosen species is occupied. Default: the garden has plants. */
  swapAvailable?: boolean;
  /** The floating widget (Document PiP) is supported. Default true. */
  widgetSupported?: boolean;
}

export interface TipDef {
  id: TipId;
  /** the control this tip sits next to (for the UI to anchor it) */
  anchor: string;
  copy: string;
  relevant(state: GardenState, ctx: Required<TipContext>): boolean;
}

const idle = (s: GardenState) => s.session === null && s.pendingReward === null;
const placing = (s: GardenState) => s.pendingReward !== null && s.pendingReward.chosen !== null;

export const TIPS: readonly TipDef[] = [
  {
    id: 'duration',
    anchor: 'duration',
    copy: "Slide to choose how long you'll study. Longer sessions grow rarer plants.",
    relevant: idle,
  },
  {
    id: 'notifications',
    anchor: 'start',
    copy: "When you begin, we'll ask once if we may chime softly when your time is up.",
    relevant: (s) => idle(s) && s.settings.notifications === 'unasked',
  },
  {
    id: 'widget',
    anchor: 'widget',
    copy: 'Open the little floating timer to keep the garden with you while you work elsewhere.',
    relevant: (s, ctx) => s.session !== null && ctx.widgetSupported,
  },
  {
    id: 'placement',
    anchor: 'garden',
    copy: 'Choose one of the softly glowing spots to plant it.',
    relevant: placing,
  },
  {
    id: 'swap',
    anchor: 'garden',
    copy: 'A glowing spot that is already in bloom can be replanted. The old plant is pressed and kept.',
    relevant: (s, ctx) => placing(s) && ctx.swapAvailable,
  },
  {
    id: 'pressed',
    anchor: 'herbarium',
    copy: 'Plants you replace are pressed into your herbarium. Open the book to visit them.',
    relevant: (s) => s.pressed.length > 0,
  },
  {
    id: 'sound',
    anchor: 'sound',
    copy: 'Tap the speaker for quiet garden sounds. It starts muted.',
    relevant: () => true,
  },
];

export const TIP_IDS: readonly TipId[] = TIPS.map((t) => t.id);

export function getTip(id: string): TipDef | undefined {
  return TIPS.find((t) => t.id === id);
}

export function isRetired(state: Pick<GardenState, 'tips'>, id: string): boolean {
  return state.tips[id] === 'seen';
}

const withDefaults = (state: GardenState, ctx: TipContext = {}): Required<TipContext> => ({
  swapAvailable: ctx.swapAvailable ?? state.plants.length > 0,
  widgetSupported: ctx.widgetSupported ?? true,
});

/** Tips to show right now: relevant and not retired, in registry order. */
export function activeTips(state: GardenState, ctx?: TipContext): TipDef[] {
  const c = withDefaults(state, ctx);
  return TIPS.filter((t) => !isRetired(state, t.id) && t.relevant(state, c));
}

/** Every tip with its retired flag — the ⓘ list. */
export function allTips(state: GardenState): Array<TipDef & { retired: boolean }> {
  return TIPS.map((t) => ({ ...t, retired: isRetired(state, t.id) }));
}

/**
 * Tips that an applied action proves the gardener has now used (and that are not yet retired).
 * The controller dispatches `tip/retire` for each. Tips for UI-only mechanisms (widget, pressed)
 * are retired by the UI via `controller.retireTip(id)`.
 */
export function tipsRetiredBy(action: Action, prev: GardenState, next: GardenState): TipId[] {
  if (next === prev) return [];
  const used: TipId[] = [];
  switch (action.type) {
    case 'session/start':
      if (next.session && !prev.session) used.push('duration');
      break;
    case 'plant/place':
      used.push('placement');
      if (next.pressed.length > prev.pressed.length) used.push('swap');
      break;
    case 'settings/update':
      if (next.settings.muted !== prev.settings.muted) used.push('sound');
      if (prev.settings.notifications === 'unasked' && next.settings.notifications !== 'unasked') {
        used.push('notifications');
      }
      break;
    default:
      break;
  }
  return used.filter((id) => !isRetired(next, id));
}
