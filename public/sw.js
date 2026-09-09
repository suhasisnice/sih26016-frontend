/* BhoomiMitra's push service worker.
   Registered once from src/lib/push.js, scoped to the whole site by living
   at the domain root (Chromium's push service requires the SW that
   handles the push event to be in the same scope the subscription was
   created under). Deliberately does nothing else — no caching, no offline
   shell — this exists only to receive push events while no BhoomiMitra tab
   is open, which is the one thing a page's own JavaScript cannot do. */

self.addEventListener('push', (event) => {
  let payload = { title: 'BhoomiMitra', body: 'Your land acquisition status has an update.' };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    /* A push with a non-JSON body still shows something rather than nothing. */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/brand/logo.png',
      badge: '/brand/logo.png',
    }),
  );
});

/* Focus an already-open tab if there is one, instead of always opening a
   new one — a citizen clicking a second notification shouldn't accumulate
   BhoomiMitra tabs. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/notices');
      return undefined;
    }),
  );
});
