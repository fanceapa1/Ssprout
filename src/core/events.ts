import type { OccurrenceView } from './schedule';
import type { ActiveSession, PlantInstance, PressedFlower, Settings } from './state';

/**
 * Typed app-wide events (contract: docs/ARCHITECTURE.md › Events).
 * Events announce things that happened; state changes go through the Store.
 */
export interface EventMap {
  /**
   * a session was planted and is now the active one; `pausedId` is the session that was active
   * before (it now waits, paused), if any (ADR 0150)
   */
  'session:start': { session: ActiveSession; pausedId?: string | null };
  /** `reason`: the gardener paused, or the session was left for another one (start / switch) */
  'session:pause': { sessionId: string; at: number; reason?: 'user' | 'switch' };
  'session:resume': { sessionId: string; at: number };
  /**
   * another in-progress session became the active one (`from`: the one left, now paused, or null
   * when none was active). Emitted after the matching pause/resume events (ADR 0152).
   */
  'session:switch': { from: string | null; to: string; at: number };
  /** `sessionId` ended without a plant; the others in progress are untouched */
  'session:cancel': { sessionId: string; at: number };
  /** a break block of the active session began (emitted once, from the tick; at most the current block) */
  'session:break': { blockIndex: number; sessionId: string };
  /** a focus block after a break began */
  'session:focus': { blockIndex: number; sessionId: string };
  /**
   * the active session's plant was watered: in a break by the gardener (`auto: false`), or by the
   * automatic focus watering every 4–10 focused minutes (`auto: true`, ADR 0153)
   */
  'session:water': { blockIndex: number; sessionId: string; auto: boolean };
  /** the plan ended; `plant` is the finalised plant */
  'session:complete': { sessionId: string; plant: PlantInstance };
  'plant:placed': { plant: PlantInstance };
  'plant:swapped': { plant: PlantInstance; removed: PressedFlower };
  'fauna:arrived': { id: string };
  'tip:retired': { id: string };
  'settings:changed': { settings: Settings };
  /**
   * a scheduled occurrence's time has come: it waits for one-tap Start (emitted once per
   * occurrence per page, from the scheduler's tick; ADR 0172)
   */
  'schedule:due': { occurrence: OccurrenceView };
}

export type EventName = keyof EventMap;
export type Handler<K extends EventName> = (payload: EventMap[K]) => void;

export interface EventBus {
  /** Subscribe; returns an unsubscribe function. */
  on<K extends EventName>(name: K, fn: Handler<K>): () => void;
  /** Subscribe for a single delivery. */
  once<K extends EventName>(name: K, fn: Handler<K>): () => void;
  off<K extends EventName>(name: K, fn: Handler<K>): void;
  /**
   * Deliver synchronously to the handlers registered at the moment of emit, in subscription
   * order. A throwing handler does not prevent the others from running; its error goes to
   * `onError`.
   */
  emit<K extends EventName>(name: K, payload: EventMap[K]): void;
  clear(): void;
}

export const EVENT_NAMES: readonly EventName[] = [
  'session:start',
  'session:pause',
  'session:resume',
  'session:switch',
  'session:cancel',
  'session:break',
  'session:focus',
  'session:water',
  'session:complete',
  'plant:placed',
  'plant:swapped',
  'fauna:arrived',
  'tip:retired',
  'settings:changed',
  'schedule:due',
];

export function createEventBus(
  onError: (err: unknown, name: EventName) => void = (err, name) =>
    console.error(`[events] handler for ${name} threw`, err),
): EventBus {
  const handlers = new Map<EventName, Set<Handler<never>>>();

  const setFor = (name: EventName): Set<Handler<never>> => {
    let set = handlers.get(name);
    if (!set) {
      set = new Set();
      handlers.set(name, set);
    }
    return set;
  };

  const bus: EventBus = {
    on(name, fn) {
      setFor(name).add(fn as Handler<never>);
      return () => bus.off(name, fn);
    },
    once(name, fn) {
      const wrapped: typeof fn = (payload) => {
        off();
        fn(payload);
      };
      const off = bus.on(name, wrapped);
      return off;
    },
    off(name, fn) {
      handlers.get(name)?.delete(fn as Handler<never>);
    },
    emit(name, payload) {
      const set = handlers.get(name);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          (fn as Handler<typeof name>)(payload);
        } catch (err) {
          onError(err, name);
        }
      }
    },
    clear() {
      handlers.clear();
    },
  };
  return bus;
}
