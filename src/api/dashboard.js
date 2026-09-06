import { api, qs } from './client';

export function kpis(params, opts) {
  return api.get(`/dashboard/kpis${qs(params)}`, opts);
}

export function alerts(params, opts) {
  return api.get(`/dashboard/alerts${qs(params)}`, opts);
}

/* One row per case with an open finding, worst first — not one row per
   finding the way alerts() is. See AttentionPanel.jsx. */
export function attention(params, opts) {
  return api.get(`/dashboard/attention${qs(params)}`, opts);
}

/* Named cases-by-stage on the API; CLAUDE.md 6 calls it stage-distribution. */
export function casesByStage(opts) {
  return api.get('/dashboard/cases-by-stage', opts);
}

/* Month-by-month progress. Every other dashboard figure is a snapshot of
   now, which cannot answer "are we speeding up or slowing down". */
export function trends(params, opts) {
  return api.get(`/dashboard/trends${qs(params)}`, opts);
}

/* Projected completion and delay risk, worst first. Each item carries the
   evidence behind its score — an officer whose case has been flagged is
   entitled to see which signal did it. */
export function forecast(params, opts) {
  return api.get(`/dashboard/forecast${qs(params)}`, opts);
}

/* Cases in an on-ground stage with something a site visit would actually
   resolve — no parcels yet, a parcel missing its surveyed boundary, or a
   document this stage requires but doesn't have. See FieldWork.jsx. */
export function fieldWork(params, opts) {
  return api.get(`/dashboard/field-work${qs(params)}`, opts);
}
