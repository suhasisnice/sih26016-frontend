import { api, qs } from './client';

export function list(params, opts) {
  return api.get(`/notifications${qs(params)}`, opts);
}

/* Just the badge number. Separate from list() because the nav polls it and
   does not need fifty rows to render one integer. */
export function unreadCount(opts) {
  return api.get('/notifications/unread-count', opts);
}

/* Omit ids entirely to mark everything read — the API treats an empty array
   as an error rather than as "all", so the two cases stay distinguishable. */
export function markRead(notificationIds, opts) {
  return api.post(
    '/notifications/mark-read',
    notificationIds ? { notification_ids: notificationIds } : {},
    opts,
  );
}
