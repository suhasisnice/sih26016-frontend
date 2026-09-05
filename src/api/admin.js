import { api } from './client';

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
