import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { injectPrecache } from './sw-manifest';

/**
 * `public/sw.js` is plain JS copied as it is, so these tests run its text in a fake worker scope:
 * the listeners it adds, which requests its fetch handler takes, and install and activate against
 * an in-memory CacheStorage (ADR 0230). The real browser is covered by tests/e2e/sw-cache.spec.ts.
 */
const SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://example.github.io';
const SW_URL = `${ORIGIN}/Ssprout/sw.js`;
const URLS = ['/Ssprout/', '/Ssprout/assets/main-abc.js', '/Ssprout/assets/main-def.css'];

const abs = (r: string | Request) => (typeof r === 'string' ? new URL(r, SW_URL).href : r.url);

function fakeCaches() {
  const store = new Map<string, Map<string, Response>>();
  const cache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    return {
      match: async (r: string | Request) => entries.get(abs(r))?.clone(),
      put: async (r: string | Request, res: Response) => void entries.set(abs(r), res),
    };
  };
  return {
    store,
    open: async (name: string) => cache(name),
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (r: string | Request, opts?: { cacheName?: string }) => {
      for (const [name, entries] of store) {
        if (opts?.cacheName && name !== opts.cacheName) continue;
        const hit = entries.get(abs(r));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
}

type Listener = (event: unknown) => void;

function boot(manifest?: { urls: string[]; version: string }, fetchImpl?: (r: Request) => Promise<Response>) {
  const listeners = new Map<string, Listener>();
  const preload = { enable: vi.fn(async () => {}), disable: vi.fn(async () => {}) };
  const self = {
    location: new URL(SW_URL),
    registration: { scope: `${ORIGIN}/Ssprout/`, navigationPreload: preload },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
  };
  const caches = fakeCaches();
  const fetch = vi.fn(fetchImpl ?? (async () => new Response('ok')));
  const text = manifest ? injectPrecache(SOURCE, { ...manifest, bytes: 0 }) : SOURCE;
  new Function('self', 'caches', 'fetch', text)(self, caches, fetch);
  /** Dispatch an extendable event and wait for what it extended. */
  const dispatch = async (type: string, extra: object = {}) => {
    const waits: Promise<unknown>[] = [];
    listeners.get(type)!({ ...extra, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { listeners, self, caches, fetch, preload, dispatch };
}

const live = (fetchImpl?: (r: Request) => Promise<Response>) => boot({ urls: URLS, version: 'v2' }, fetchImpl);

describe('service worker', () => {
  it('on the dev server caches nothing and has no fetch handler', async () => {
    const sw = boot();
    expect([...sw.listeners.keys()].sort()).toEqual(['activate', 'install', 'notificationclick']);
    await sw.dispatch('install');
    await sw.dispatch('activate');
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    expect(sw.self.clients.claim).toHaveBeenCalled();
    expect(sw.preload.disable).toHaveBeenCalled();
    expect(sw.fetch).not.toHaveBeenCalled();
    expect(sw.caches.store.size).toBe(0);
  });

  it('takes app navigations and assets in scope, and leaves everything else to the network', () => {
    const sw = live();
    const takes = (url: string, init: { method?: string; mode?: string } = {}) => {
      const respondWith = vi.fn();
      const request = { url: new URL(url, SW_URL).href, method: init.method ?? 'GET', mode: init.mode ?? 'cors' };
      sw.listeners.get('fetch')!({ request, respondWith, waitUntil: () => {} });
      respondWith.mock.calls[0]?.[0]?.catch?.(() => {});
      return respondWith.mock.calls.length === 1;
    };
    expect(takes('/Ssprout/?dev', { mode: 'navigate' })).toBe(true);
    expect(takes('/Ssprout/assets/main-abc.js')).toBe(true);
    expect(takes('/Ssprout/assets/lazy-xyz.js')).toBe(true);
    expect(takes('/Ssprout/assets/main-abc.js', { method: 'POST' })).toBe(false);
    expect(takes('/Ssprout/sw.js')).toBe(false);
    expect(takes('/Ssprout/studio.html')).toBe(false);
    expect(takes('/Other/assets/main-abc.js')).toBe(false);
    expect(takes('https://fonts.example.com/Ssprout/assets/a.woff2')).toBe(false);
  });

  it('precaches the list into the version cache, retrying a failed fetch once', async () => {
    let failures = 1;
    const sw = live(async (r) => {
      if (r.url.endsWith('.css') && failures-- > 0) throw new TypeError('network');
      return new Response(r.url);
    });
    await sw.dispatch('install');
    const cached = [...sw.caches.store.get('sprout-v2')!.keys()].map((u) => new URL(u).pathname);
    expect(cached.sort()).toEqual([...URLS].sort());
    expect(sw.fetch).toHaveBeenCalledTimes(URLS.length + 1);
    // the page is fetched past the HTTP cache: its text is part of the version
    const pageRequest = sw.fetch.mock.calls.map(([r]) => r).find((r) => r.url.endsWith('/Ssprout/'));
    expect(pageRequest?.cache).toBe('no-cache');
  });

  it('fails the install when a file is still missing, and resumes on the next try', async () => {
    let down = true;
    const sw = live(async (r) => (down && r.url.endsWith('.css') ? new Response('', { status: 503 }) : new Response(r.url)));
    await expect(sw.dispatch('install')).rejects.toThrow(/main-def\.css/);
    down = false;
    sw.fetch.mockClear();
    await sw.dispatch('install');
    expect(sw.fetch).toHaveBeenCalledTimes(1);
    expect(sw.caches.store.get('sprout-v2')!.size).toBe(URLS.length);
  });

  it('on activate deletes other versions but the previous one, and leaves foreign caches', async () => {
    const sw = live();
    for (const name of ['sprout-v0', 'sprout-v1', 'other-app', 'sprout-v2']) await sw.caches.open(name);
    const meta = await sw.caches.open('sprout-meta');
    await meta.put('/Ssprout/sprout-active-version', new Response(JSON.stringify({ version: 'v1', previous: 'v0' })));
    await sw.dispatch('activate');
    expect([...sw.caches.store.keys()].sort()).toEqual(['other-app', 'sprout-meta', 'sprout-v1', 'sprout-v2']);
    expect(await (await meta.match('/Ssprout/sprout-active-version'))!.json()).toEqual({ version: 'v2', previous: 'v1' });
    expect(sw.preload.enable).toHaveBeenCalled();
    expect(sw.self.clients.claim).toHaveBeenCalled();
    // activating the same version again keeps the same previous version
    await sw.dispatch('activate');
    expect([...sw.caches.store.keys()].sort()).toEqual(['other-app', 'sprout-meta', 'sprout-v1', 'sprout-v2']);
  });
});
