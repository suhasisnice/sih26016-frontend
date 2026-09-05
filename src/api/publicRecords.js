import { api, qs } from './client';

/* Verified public-source acquisition records — see
   data/real_acquisition_seed/README.md. Unauthenticated on the backend,
   same as notices: every figure here already sits in a government gazette
   or a published news report. */

export function list(params, opts) {
  return api.get(`/public-acquisitions${qs(params)}`, opts);
}

export function summary(opts) {
  return api.get('/public-acquisitions/summary', opts);
}
