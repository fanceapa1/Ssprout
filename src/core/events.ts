import type { ActiveSession, PendingReward, PlantInstance, PressedFlower, Settings } from './state';

/**
 * Typed app-wide events (contract: docs/ARCHITECTURE.md › Events).
 * Events announce things that happened; state changes go through the Store.
 */
export interface EventMap {
  'session:start': { session: ActiveSession };
  'session:pause': { sessionId: string; at: number };
  'session:resume': { sessionId: string; at: number };
  'session:cancel': { sessionId: string; at: number };
  'session:complete': { sessionId: string; reward: PendingReward };
  'reward:chosen': { speciesId: string };
  'plant:placed': { plant: PlantInstance };
  'plant:swapped': { plant: PlantInstance; removed: PressedFlower };
  'fauna:arrived': { id: string };
  'tip:retired': { id: string };
  'settings:changed': { settings: Settings };
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
  'session:cancel',
  'session:complete',
  'reward:chosen',
  'plant:placed',
  'plant:swapped',
  'fauna:arrived',
  'tip:retired',
  'settings:changed',
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
