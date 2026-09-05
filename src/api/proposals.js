import { api, qs } from './client';

/* The proposal pipeline — submission, scrutiny, sanction.

   Envelope matches the case list: {items, total, limit, offset}, plus
   `by_status` for the pipeline strip above the table. */

export function list(params, opts) {
  return api.get(`/proposals${qs(params)}`, opts);
}

export function get(proposalId, opts) {
  return api.get(`/proposals/${proposalId}`, opts);
}

export function create(payload, opts) {
  return api.post('/proposals', payload, opts);
}

export function update(proposalId, payload, opts) {
  return api.patch(`/proposals/${proposalId}`, payload, opts);
}

/* Every move goes through one route. The detail response carries
   `allowed_transitions` for the signed-in user, so the buttons a screen
   renders are exactly what the server will accept. */
export function transition(proposalId, toStatus, note, opts) {
  return api.post(
    `/proposals/${proposalId}/transition`,
    { to_status: toStatus, note: note || null },
    opts,
  );
}
