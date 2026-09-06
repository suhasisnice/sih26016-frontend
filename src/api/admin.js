import { api, qs } from './client';

/* Re-run every alert rule and rebuild the alerts table, then deliver what is
   new to the officers responsible.

   The server also does this on a clock (RULES_INTERVAL_MINUTES), so this is
   the manual trigger rather than the only one — useful right before a
   review, and the honest answer to "how do I know the figures are current".
   Safe to press repeatedly: the alerts table is rebuilt from scratch every
   run, and the notification fan-out is guarded by a unique index over unread
   rows, so a second press adds nothing rather than duplicating everyone's
   inbox. */
export function runRules(opts) {
  return api.post('/admin/run-rules', undefined, opts);
}

/* Invitations are how every non-seeded account gets created — there is no
   open signup. `createInviteCode`'s response is the only time the code
   itself is readable; the list and revoke calls only ever see metadata, the
   same asymmetry the backend enforces. */
export function createInviteCode(payload, opts) {
  return api.post('/admin/invite-codes', payload, opts);
}

export function listInviteCodes(opts) {
  return api.get('/admin/invite-codes', opts);
}

export function revokeInviteCode(inviteId, opts) {
  return api.post(`/admin/invite-codes/${inviteId}/revoke`, undefined, opts);
}

/* The directory of accounts that already exist — distinct from the invite
   codes above, which are how a NEW one gets created. */
export function listUsers(params, opts) {
  return api.get(`/admin/users${qs(params)}`, opts);
}

export function deactivateUser(userId, opts) {
  return api.post(`/admin/users/${userId}/deactivate`, undefined, opts);
}

export function reactivateUser(userId, opts) {
  return api.post(`/admin/users/${userId}/reactivate`, undefined, opts);
}

/* The one moment the new password is readable — same one-time-reveal rule
   as createInviteCode above. */
export function resetUserPassword(userId, opts) {
  return api.post(`/admin/users/${userId}/reset-password`, undefined, opts);
}
