import { api, qs } from './client';

export function kpis(params, opts) {
  return api.get(`/dashboard/kpis${qs(params)}`, opts);
}

export function alerts(params, opts) {
  return api.get(`/dashboard/alerts${qs(params)}`, opts);
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
