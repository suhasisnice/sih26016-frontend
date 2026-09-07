/* A local mirror of in-progress survey-wizard state, keyed per task.

   This is deliberately NOT an offline-sync engine — no queue, no service
   worker, no background retry. It exists so that closing the tab, losing
   signal mid-form, or a slow network doesn't lose what the officer just
   typed before the next successful "Save progress" PATCH reaches the
   server. See CaseDetail's Next-Action-style honesty rule: this never
   claims a sync happened until save.run() actually resolves. */

const PREFIX = 'bhoomimitra.survey-draft.';

export function loadDraft(taskId) {
  try {
    const raw = localStorage.getItem(PREFIX + taskId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(taskId, draft) {
  try {
    localStorage.setItem(PREFIX + taskId, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    /* Private window or full storage — the wizard still works from
       component state, it just cannot survive a reload. */
  }
}

export function clearDraft(taskId) {
  try {
    localStorage.removeItem(PREFIX + taskId);
  } catch {
    /* nothing to clean up if this throws */
  }
}
