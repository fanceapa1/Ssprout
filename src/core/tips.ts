import { hasBreaks } from './plans';
import { sessionTimeline } from './session';
import type { Action, GardenState } from './state';

/**
 * Onboarding hints (SPEC §7). A tip shows while it is relevant and not yet retired; it is retired
 * the first time the gardener uses that mechanism. Retired tips stay listed behind the ⓘ.
 */

export type TipId =
  | 'task'
  | 'duration'
  | 'plan'
  | 'placement'
  | 'swap'
  | 'notifications'
  | 'widget'
  | 'water'
  | 'pressed'
  | 'sound'
  | 'switch';

/** Facts the state alone cannot tell (supplied by the UI). */
export interface TipContext {
  /** Current time, to know whether a session is in a break (the `water` tip). Default: never. */
  now?: number;
  /** Some compatible slot for the species being placed is occupied. Default: the garden has plants. */
  swapAvailable?: boolean;
  /** The floating widget (Document PiP) is supported. Default true. */
  widgetSupported?: boolean;
}

interface ResolvedContext {
  now: number | null;
  swapAvailable: boolean;
  widgetSupported: boolean;
}

export interface TipDef {
  id: TipId;
  /** the control this tip sits next to (for the UI to anchor it) */
  anchor: string;
  copy: string;
  relevant(state: GardenState, ctx: ResolvedContext): boolean;
}

const idle = (s: GardenState) => s.session === null;
const inBreak = (s: GardenState, now: number | null) =>
  s.session !== null && now !== null && sessionTimeline(s.session, now).block.kind === 'break';

/** Registry order = the order of the start flow, then the session, then the garden. */
export const TIPS: readonly TipDef[] = [
  {
    id: 'task',
    anchor: 'task',
    copy: 'Name what you are studying. Your plant will carry its name.',
    relevant: idle,
  },
  {
    id: 'duration',
    anchor: 'duration',
    copy: "Slide to choose how long you'll study. Longer sessions grow rarer plants.",
    relevant: idle,
  },
  {
    id: 'plan',
    anchor: 'plan',
    copy: 'Breaks are watering moments — your plant will be glad of them.',
    relevant: idle,
  },
  {
    id: 'placement',
    anchor: 'garden',
    copy: 'Choose one of the softly glowing spots for your seedling.',
    relevant: idle,
  },
  {
    id: 'swap',
    anchor: 'garden',
    copy: 'A glowing spot already in bloom can be replanted. The old plant is pressed and kept.',
    relevant: (s, ctx) => idle(s) && ctx.swapAvailable,
  },
  {
    id: 'notifications',
    anchor: 'start',
    copy: "When you begin, we'll ask once if we may chime softly at breaks and at the end.",
    relevant: (s) => idle(s) && s.settings.notifications === 'unasked',
  },
  {
    id: 'widget',
    anchor: 'widget',
    copy: 'Open the little floating window to keep your plant with you while you work elsewhere.',
    relevant: (s, ctx) => s.session !== null && ctx.widgetSupported,
  },
  {
    id: 'water',
    anchor: 'water',
    copy: 'Tap the watering can to give your plant a drink. No rush, it will wait.',
    relevant: (s, ctx) => inBreak(s, ctx.now),
  },
  {
    id: 'switch',
    anchor: 'switch',
    copy: 'Several seedlings can grow at once. Switch to another — the one you leave simply waits.',
    relevant: (s) => s.waiting.length > 0,
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

const resolve = (state: GardenState, ctx: TipContext = {}): ResolvedContext => ({
  now: ctx.now ?? null,
  swapAvailable: ctx.swapAvailable ?? state.plants.length > 0,
  widgetSupported: ctx.widgetSupported ?? true,
});

/** Tips to show right now: relevant and not retired, in registry order. */
export function activeTips(state: GardenState, ctx?: TipContext): TipDef[] {
  const c = resolve(state, ctx);
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
    case 'session/start': {
      const s = next.session;
      if (!s || s.id === prev.session?.id) break;
      used.push('task', 'duration', 'placement');
      if (hasBreaks(s.plan)) used.push('plan');
      if (s.displacedPlantId !== null) used.push('swap');
      break;
    }
    case 'session/water':
      used.push('water');
      break;
    case 'session/switch':
      used.push('switch');
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
