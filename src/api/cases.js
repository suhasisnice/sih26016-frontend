import { api, qs } from './client';

/* Pagination is limit/offset, not page/page_size. The envelope is
   {items, total, limit, offset}. */
export function list(params, opts) {
  return api.get(`/cases${qs(params)}`, opts);
}

export function get(caseId, opts) {
  return api.get(`/cases/${caseId}`, opts);
}

export function create(payload, opts) {
  return api.post('/cases', payload, opts);
}

export function update(caseId, payload, opts) {
  return api.patch(`/cases/${caseId}`, payload, opts);
}

/* Stage history is NOT a separate route — it comes back inline on the case
   detail as `stage_history`, with `allowed_next_stages` alongside it. */
export function advance(caseId, toStage, note, opts) {
  return api.post(`/cases/${caseId}/advance`, { to_stage: toStage, note: note || null }, opts);
}

export function audit(caseId, limit, opts) {
  return api.get(`/cases/${caseId}/audit${qs({ limit })}`, opts);
}

/* The requiring body's deposit ledger — separate from disbursement
   (api/persons.js updateCompensation). See CompensationModal for why the
   two never merge. */
export function fundDeposits(caseId, opts) {
  return api.get(`/cases/${caseId}/fund-deposits`, opts);
}

export function recordFundDeposit(caseId, payload, opts) {
  return api.post(`/cases/${caseId}/fund-deposits`, payload, opts);
}
