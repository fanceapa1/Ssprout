import type { Clock } from '../core/clock';
import type { Settings, Store } from '../core/state';
import { payloadSessionId, type WidgetBus, type WidgetController, type WidgetSession } from './contract';

/**
 * Session notifications (SPEC §2, §6): a break starts, the next focus block starts, the plant has
 * bloomed. Policy (ADR 0091, docs/systems/widget.md):
 * - Permission is asked once, at the first `session:start` (the bus event is emitted
 *   synchronously inside `controller.start()`, so a Begin click is still the active user
 *   gesture). `requestPermissionFromGesture()` is also exported for the UI to call directly.
 * - The answer is stored with `controller.updateSettings({ notifications })`; a dismissed prompt
 *   leaves `unasked` and is not repeated during this page's lifetime. An in-app `denied` is an
 *   opt-out that a browser grant alone does not undo.
 * - We notify only when permission is granted, the user has not opted out, the page is not
 *   visible-and-focused (the in-page flow shows it) and this moment (session × block × kind)
 *   has not been notified yet. One tag with `renotify`, so each new message replaces the last.
 * - Delivered through the service worker registration when available (works in more places,
 *   e.g. Android Chrome, and the SW focuses the app on click), else `new Notification`.
 */

export type PermissionState = 'default' | 'granted' | 'denied';
export type PermissionResult = PermissionState | 'unsupported';

export const NOTIFICATION_TAG = 'study-sprout-session';

export type NotifyKind = 'break' | 'focus' | 'complete' | 'scheduled';

/**
 * The text of each notification. `plant` is the species name, `task` the session's task (for
 * `scheduled`: the scheduled session's name; no plant is chosen yet).
 */
export function notificationText(kind: NotifyKind, plant: string, task: string): { title: string; body: string } {
  switch (kind) {
    case 'scheduled':
      return { title: `It’s time for “${task}”.`, body: 'Whenever you are ready, a card in your garden will start it.' };
    case 'break':
      return { title: `Time for a break — your ${plant} is thirsty.`, body: 'Tap the watering can when you are ready.' };
    case 'focus':
      return { title: `Back to focus — ${task}.`, body: `Your ${plant} is growing again.` };
    default:
      return { title: 'Your session is complete', body: `Your ${plant} has bloomed — return to your garden.` };
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  icon?: string;
  timestamp?: number;
  /** read by the service worker's notificationclick handler */
  data: { url: string; sessionId: string; kind: NotifyKind };
}

/** Everything browser-specific, injectable for tests. */
export interface NotificationEnv {
  readonly supported: boolean;
  permission(): PermissionState;
  /** Must be called synchronously inside a user gesture. */
  request(): Promise<PermissionState>;
  /** The page is visible and focused: the in-page flow will show the moment. */
  attended(): boolean;
  /** Prepare delivery early (register the service worker). Safe to call repeatedly. */
  prepare(): void;
  show(n: NotificationPayload): Promise<'service-worker' | 'page' | 'failed'>;
  /** The app URL a click should return to. */
  appUrl(): string;
  /** Optional painted icon for the notification. */
  icon?(kind: NotifyKind): string | undefined;
}

export type NotifyDecision = 'notify' | 'unsupported' | 'not-granted' | 'opted-out' | 'attended' | 'duplicate';

/** Pure decision: should this moment produce a system notification? */
export function decideNotification(input: {
  supported: boolean;
  permission: PermissionState;
  setting: Settings['notifications'];
  attended: boolean;
  alreadyNotified: boolean;
}): NotifyDecision {
  if (!input.supported) return 'unsupported';
  if (input.permission !== 'granted') return 'not-granted';
  if (input.setting === 'denied') return 'opted-out';
  if (input.alreadyNotified) return 'duplicate';
  if (input.attended) return 'attended';
  return 'notify';
}

/**
 * Passive sync of the stored setting with the browser's permission (the user may have changed it
 * in the browser). Returns the new setting, or null when nothing should change. An explicit
 * `requestPermissionFromGesture()` call instead stores whatever the browser answers.
 */
export function reconcileSetting(setting: Settings['notifications'], permission: PermissionResult): Settings['notifications'] | null {
  if (permission === 'unsupported') return null;
  // an in-app 'denied' is an explicit opt-out: a browser grant alone does not undo it
  if (permission === 'granted') return setting === 'unasked' ? 'granted' : null;
  if (permission === 'denied') return setting === 'denied' ? null : 'denied';
  // 'default': permission was reset in the browser — ask again on the next start
  return setting === 'granted' ? 'unasked' : null;
}

/** Should `session:start` trigger the permission prompt? */
export function shouldAsk(setting: Settings['notifications'], permission: PermissionResult, askedThisPage: boolean): boolean {
  return setting === 'unasked' && permission === 'default' && !askedThisPage;
}

export interface Notifier {
  /** Ask for permission (call inside a click handler). Resolves with the browser's answer. */
  requestPermissionFromGesture(): Promise<PermissionResult>;
  /** Last decision taken (dev/tests). */
  lastDecision(): { kind: NotifyKind; decision: NotifyDecision } | null;
  dispose(): void;
}

export interface NotifierDeps {
  controller: Pick<WidgetController, 'updateSettings' | 'status' | 'onTick'>;
  store: Pick<Store, 'get'>;
  bus: WidgetBus;
  clock: Clock;
  env: NotificationEnv;
  /** display name of a species (default: "plant") */
  speciesName?: (id: string) => string | undefined;
}

export function createNotifier({ controller, store, bus, clock, env, speciesName }: NotifierDeps): Notifier {
  let asked = false;
  let pending: Promise<PermissionResult> | null = null;
  let last: { kind: NotifyKind; decision: NotifyDecision } | null = null;
  const notified = new Set<string>();
  let disposed = false;
  /** the latest session seen (a completed session is gone from the status by the time we hear) */
  let lastSession: WidgetSession | null = controller.status().session;
  const remember = (): void => {
    const s = controller.status().session;
    if (s) lastSession = s;
  };

  const permission = (): PermissionResult => (env.supported ? env.permission() : 'unsupported');

  const sync = (p: PermissionResult): void => {
    const next = reconcileSetting(store.get().settings.notifications, p);
    if (next) controller.updateSettings({ notifications: next });
    if (p === 'granted') env.prepare();
  };

  const requestPermissionFromGesture = (): Promise<PermissionResult> => {
    if (disposed) return Promise.resolve(permission());
    if (pending) return pending;
    const p = permission();
    if (p === 'unsupported') return Promise.resolve(p);
    if (p !== 'default') {
      // explicit request (e.g. a UI toggle): store the browser's answer as is
      if (store.get().settings.notifications !== p) controller.updateSettings({ notifications: p });
      if (p === 'granted') env.prepare();
      return Promise.resolve(p);
    }
    asked = true;
    let request: Promise<PermissionState>;
    try {
      request = env.request(); // synchronously, while the gesture is active
    } catch {
      request = Promise.resolve(env.permission());
    }
    pending = request
      .catch(() => env.permission())
      .then((answer) => {
        pending = null;
        // 'default' (dismissed) leaves the setting 'unasked'
        if (!disposed && answer !== 'default') {
          controller.updateSettings({ notifications: answer });
          if (answer === 'granted') env.prepare();
        }
        return answer;
      });
    return pending;
  };

  /** A scheduled session's time has come (ADR 0174): same policy, keyed by the occurrence. */
  const notifyScheduled = (payload: unknown): void => {
    const o = (payload as { occurrence?: { key?: unknown; name?: unknown } } | null)?.occurrence;
    if (typeof o?.key !== 'string') return;
    const key = `scheduled:${o.key}`;
    const decision = decideNotification({
      supported: env.supported,
      permission: env.supported ? env.permission() : 'default',
      setting: store.get().settings.notifications,
      attended: env.attended(),
      alreadyNotified: notified.has(key),
    });
    last = { kind: 'scheduled', decision };
    if (decision !== 'notify') return;
    notified.add(key);
    const { title, body } = notificationText('scheduled', 'plant', typeof o.name === 'string' && o.name ? o.name : 'your study');
    void env.show({
      title,
      body,
      tag: NOTIFICATION_TAG,
      icon: env.icon?.('scheduled'),
      timestamp: clock.now(),
      data: { url: env.appUrl(), sessionId: o.key, kind: 'scheduled' },
    });
  };

  const notify = (kind: NotifyKind, payload: unknown): void => {
    remember();
    const st = controller.status();
    const s = kind === 'complete' ? lastSession : (st.session ?? lastSession);
    const sessionId = payloadSessionId(payload) ?? s?.id ?? 'session';
    const p = payload as { blockIndex?: unknown } | null;
    const blockIndex = typeof p?.blockIndex === 'number' ? p.blockIndex : (st.timeline?.blockIndex ?? -1);
    const key = kind === 'complete' ? `${sessionId}:complete` : `${sessionId}:${kind}:${blockIndex}`;
    const decision = decideNotification({
      supported: env.supported,
      permission: env.supported ? env.permission() : 'default',
      setting: store.get().settings.notifications,
      attended: env.attended(),
      alreadyNotified: notified.has(key),
    });
    last = { kind, decision };
    if (decision !== 'notify') return;
    notified.add(key);
    const plant = (s && speciesName?.(s.speciesId)) || 'plant';
    const { title, body } = notificationText(kind, plant, s?.taskName || 'your study');
    void env.show({
      title,
      body,
      tag: NOTIFICATION_TAG,
      icon: env.icon?.(kind),
      timestamp: clock.now(),
      data: { url: env.appUrl(), sessionId, kind },
    });
  };

  const offs = [
    controller.onTick(remember),
    bus.on('session:start', () => {
      remember();
      const p = permission();
      if (shouldAsk(store.get().settings.notifications, p, asked)) void requestPermissionFromGesture();
      else sync(p);
    }),
    bus.on('session:break', (payload) => notify('break', payload)),
    bus.on('session:focus', (payload) => notify('focus', payload)),
    bus.on('session:complete', (payload) => notify('complete', payload)),
    bus.on('schedule:due', (payload) => notifyScheduled(payload)),
  ];

  // the browser may already know the answer (granted earlier, or blocked in site settings)
  sync(permission());

  return {
    requestPermissionFromGesture,
    lastDecision: () => last,
    dispose() {
      disposed = true;
      for (const off of offs) off();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// browser environment
// ---------------------------------------------------------------------------------------------

export interface BrowserEnvOptions {
  /** service worker script URL (default: `${BASE_URL}sw.js`) */
  swUrl?: string;
  /** service worker scope (default: Vite BASE_URL) */
  scope?: string;
  /** how long to wait for the worker to activate before falling back (ms) */
  readyTimeoutMs?: number;
  icon?: (kind: NotifyKind) => string | undefined;
}

const baseUrl = (): string => (typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/');

/** The real Notification / ServiceWorker environment of `win`. */
export function createBrowserNotificationEnv(win: Window = window, opts: BrowserEnvOptions = {}): NotificationEnv {
  const N = (win as Window & { Notification?: typeof Notification }).Notification;
  const supported = typeof N === 'function';
  const swUrl = opts.swUrl ?? `${baseUrl()}sw.js`;
  const scope = opts.scope ?? baseUrl();
  const readyTimeoutMs = opts.readyTimeoutMs ?? 4000;
  const nav = win.navigator;
  const canUseSw = 'serviceWorker' in nav && win.isSecureContext;
  let registration: Promise<ServiceWorkerRegistration | null> | null = null;

  const prepare = (): Promise<ServiceWorkerRegistration | null> => {
    if (!canUseSw) return Promise.resolve(null);
    registration ??= nav.serviceWorker.register(swUrl, { scope }).catch((err: unknown) => {
      console.warn('[notifications] service worker registration failed; using page notifications', err);
      return null;
    });
    return registration;
  };

  /** An active registration, or null if none becomes ready in time. */
  const activeRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    const reg = await prepare();
    if (!reg) return null;
    if (reg.active) return reg;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((res) => {
      timer = setTimeout(() => res(null), readyTimeoutMs);
    });
    try {
      return await Promise.race([nav.serviceWorker.ready, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  const options = (n: NotificationPayload): NotificationOptions & { timestamp?: number; renotify?: boolean } => ({
    body: n.body,
    tag: n.tag,
    icon: n.icon,
    data: n.data,
    timestamp: n.timestamp,
    renotify: true,
  });

  const pageNotification = (n: NotificationPayload): boolean => {
    if (!supported) return false;
    try {
      const note = new N(n.title, options(n));
      note.onclick = () => {
        win.focus();
        note.close();
      };
      return true;
    } catch {
      return false; // e.g. Android Chrome only allows SW notifications
    }
  };

  return {
    supported,
    permission: () => (supported ? (N.permission as PermissionState) : 'default'),
    request() {
      if (!supported) return Promise.resolve('default');
      return new Promise<PermissionState>((resolve) => {
        // old Safari takes a callback and returns undefined; everyone else returns a promise
        const r = N.requestPermission((p) => resolve(p as PermissionState));
        if (r && typeof r.then === 'function') r.then((p) => resolve(p as PermissionState), () => resolve(N.permission as PermissionState));
      });
    },
    attended: () => win.document.visibilityState === 'visible' && win.document.hasFocus(),
    prepare: () => void prepare(),
    async show(n) {
      try {
        const reg = await activeRegistration();
        if (reg) {
          await reg.showNotification(n.title, options(n));
          return 'service-worker';
        }
      } catch (err) {
        console.warn('[notifications] service worker notification failed; trying the page', err);
      }
      return pageNotification(n) ? 'page' : 'failed';
    },
    appUrl: () => win.location.href,
    icon: opts.icon,
  };
}
