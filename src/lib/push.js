/* Browser push subscription — the client half of the Web Push flow the
   backend's app/integrations/messaging/push.py sends through. Everything
   here is standard Push API; nothing vendor-specific, since VAPID has no
   SDK to depend on. */

import * as noticesApi from '../api/notices';

/* pushManager.subscribe() wants applicationServerKey as a Uint8Array, but
   the backend hands back the VAPID public key as a base64url string (the
   form RFC 8292 actually specifies it in) — this is the standard
   conversion, not something specific to this project. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function isSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/* Registered once per page load, not once per subscribe click — cheap and
   idempotent (the browser reuses an existing registration at the same
   scope), and other code paths may want the registration later without
   re-triggering a subscribe prompt. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('/sw.js').catch(() => null);
}

/* Requests notification permission, subscribes with the backend's VAPID
   key, and returns the raw PushSubscription (toJSON()'d — endpoint +
   keys.p256dh + keys.auth) ready to attach to POST /notices/subscribe.
   Throws with a message meant to be shown directly, not just logged: a
   citizen who denies the permission prompt needs to know why nothing
   happened, not see a stack trace. */
export async function subscribeToPush() {
  if (!isSupported()) {
    throw new Error('This browser does not support notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!registration) {
    throw new Error('Could not set up the browser notification service.');
  }

  const { public_key: publicKey } = await noticesApi.vapidPublicKey();

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  return subscription.toJSON();
}
