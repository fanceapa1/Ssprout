/*
 * Study Sprout service worker (docs/systems/widget.md › The service worker).
 * - Notifications (ADR 0092): a click on one brings the garden back (focus an open tab, or open
 *   the app URL).
 * - Caching (ADR 0230): the files of a build are precached into `sprout-<version>` on install.
 *   The page itself is network-first, falling back to the cached page offline. Hashed files under
 *   `assets/` are cache-first. Everything else goes to the network untouched.
 *
 * The production build writes a precache manifest into the two lines below (ADR 0229,
 * src/build/sw-manifest.ts): the URLs the garden needs and a version that changes with them.
 * The dev server keeps the empty list and version 'dev', and then this worker caches nothing
 * and has no fetch handler, so live reload works as usual.
 */
self.__SW_VERSION__ = 'dev';
self.__PRECACHE__ = [];

const VERSION = self.__SW_VERSION__;
const LIVE = VERSION !== 'dev';
const PREFIX = 'sprout-';
const CACHE = PREFIX + VERSION;
/** Remembers which version was active before this one (see `prune`). */
const META = PREFIX + 'meta';
/** The app's base path, e.g. `/Ssprout/`: the folder sw.js is served from. */
const BASE = new URL('./', self.location.href).pathname;
const ASSETS = BASE + 'assets/';
/**
 * Lookups ignore `Vary`: servers send `Vary: Accept-Encoding` (Pages) or `Vary: Origin` (vite
 * preview), and a module script's request carries headers the precache request did not, so a
 * strict match would miss. Every cached file is one fixed build file, whatever the headers.
 */
const ANY = { ignoreVary: true };

/** A navigation to the garden itself (any query, e.g. `?dev`). */
function isAppPage(url) {
  return url.pathname === BASE || url.pathname === BASE + 'index.html';
}

/** What the fetch handler does with a request: 'page', 'asset', or null (network, untouched). */
function route(request) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return null;
  if (request.mode === 'navigate') return 'page';
  if (url.pathname.startsWith(ASSETS)) return 'asset';
  return null;
}

/** Cache names to delete on activate: our other versions, except the one active before. */
function staleCaches(names, previous) {
  const keep = new Set([CACHE, META, previous ? PREFIX + previous : '']);
  return names.filter((name) => name.startsWith(PREFIX) && !keep.has(name));
}

/** A response safe to store and to serve for a navigation (a redirected one is not). */
async function storable(response) {
  if (!response.redirected) return response;
  const { status, statusText, headers } = response;
  return new Response(await response.blob(), { status, statusText, headers });
}

/**
 * Fill this version's cache. Each URL already in it is skipped (a failed install resumes), a
 * failed fetch is tried once more, and if any URL is still missing the install fails: the browser
 * keeps the current worker and tries again on a later visit, so a half-filled precache never
 * activates. The page is fetched past the HTTP cache: its text is part of the version.
 */
async function precache() {
  const cache = await caches.open(CACHE);
  const one = async (url) => {
    if (await cache.match(url, ANY)) return;
    const request = new Request(new URL(url, self.location.href), { cache: url === BASE ? 'no-cache' : 'default' });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(request);
        if (response.ok) return cache.put(url, await storable(response));
      } catch (_) {
        /* try again, then give up */
      }
    }
    throw new Error(`precache: ${url} failed`);
  };
  const results = await Promise.allSettled(self.__PRECACHE__.map(one));
  const failed = results.find((r) => r.status === 'rejected');
  if (failed) throw failed.reason;
}

/**
 * Delete caches of other versions but keep the one that was active before this version, so a
 * tab still running that build finds its lazy chunks and fonts until it reloads.
 */
async function prune() {
  const meta = await caches.open(META);
  const key = BASE + 'sprout-active-version';
  const saved = await meta.match(key);
  const record = saved ? await saved.json().catch(() => ({})) : {};
  const previous = record.version === VERSION ? record.previous : record.version;
  await meta.put(key, new Response(JSON.stringify({ version: VERSION, previous: previous || null })));
  const stale = staleCaches(await caches.keys(), previous);
  await Promise.all(stale.map((name) => caches.delete(name)));
}

/** The page: network first (through navigation preload), the cached page when that fails. */
async function page(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch (error) {
    if (!isAppPage(new URL(event.request.url))) throw error;
    const cached = (await caches.match(BASE, { ...ANY, cacheName: CACHE })) || (await caches.match(BASE, ANY));
    if (cached) return cached;
    throw error;
  }
}

/** A hashed asset: from any of our caches (an older tab's chunk lives in the previous one), else
 * from the network, stored in this version's cache. */
async function asset(event) {
  const hit = await caches.match(event.request, ANY);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
  }
  return response;
}

self.addEventListener('install', (event) => {
  // Hashed files never change, and the previous version's cache survives activation, so a new
  // worker can take over open tabs at once (ADR 0230).
  self.skipWaiting();
  if (LIVE) event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (LIVE) await prune();
      const preload = self.registration.navigationPreload;
      if (preload) await (LIVE ? preload.enable() : preload.disable());
      await self.clients.claim();
    })(),
  );
});

if (LIVE) {
  self.addEventListener('fetch', (event) => {
    const kind = route(event.request);
    if (kind === 'page') event.respondWith(page(event));
    else if (kind === 'asset') event.respondWith(asset(event));
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scope = self.registration.scope;
  const data = event.notification.data || {};
  let target = scope;
  try {
    const u = new URL(data.url || scope, scope);
    if (u.href.startsWith(scope)) target = u.href;
  } catch (_) {
    /* keep the scope */
  }
  const path = (href) => {
    try {
      return new URL(href).pathname;
    } catch (_) {
      return '';
    }
  };
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const inScope = windows.filter((c) => c.url.startsWith(scope));
      // prefer the garden tab itself (same path as the notification's url), then any app tab
      const best = inScope.find((c) => path(c.url) === path(target)) || inScope[0];
      if (best && 'focus' in best) return best.focus();
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })(),
  );
});
