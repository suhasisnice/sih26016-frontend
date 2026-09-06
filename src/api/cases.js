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
   detail as `stage_history`, with `allowed_next_stages` alongside it.
   `stepupToken` is only ever required for a handful of consequential
   stages (Declaration, Award, Possession, the last stage) — the backend
   decides which, since it alone knows STEPUP_REQUIRED_STAGES; this just
   forwards whatever the caller already obtained via
   api/biometrics.js's step-up flow, as X-Stepup-Token. */
export function advance(caseId, toStage, note, stepupToken, opts) {
  return api.post(
    `/cases/${caseId}/advance`,
    { to_stage: toStage, note: note || null },
    { ...opts, headers: stepupToken ? { 'X-Stepup-Token': stepupToken } : undefined },
  );
}

/* The closest thing a case has to "reject" — see CaseHoldRequest's
   docstring on the backend for why this sets status rather than a stage.
   Always requires a fresh step-up token. */
export function hold(caseId, note, stepupToken, opts) {
  return api.post(
    `/cases/${caseId}/hold`,
    { note },
    { ...opts, headers: { 'X-Stepup-Token': stepupToken } },
  );
}

export function resume(caseId, note, opts) {
  return api.post(`/cases/${caseId}/resume`, { note }, opts);
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
