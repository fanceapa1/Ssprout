/*
 * Study Sprout service worker — notifications only (docs/systems/widget.md, ADR 0092).
 * It has no fetch handler and caches nothing: it exists so completion notifications can be
 * shown via ServiceWorkerRegistration.showNotification and so a click on one brings the
 * garden back (focus an open tab, or open the app URL).
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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
