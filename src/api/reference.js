import { api, qs } from './client';

/* Districts, villages and projects back every filter dropdown and the
   create-case form. They live at the API root, not under /reference. */

/* Optionally narrowed to one state, so the dashboard's state selector can
   cascade into its district selector rather than listing every district in
   the country underneath a chosen state. */
export function districts(stateId, opts) {
  return api.get(`/districts${qs({ state_id: stateId })}`, opts);
}

export function villages(districtId, opts) {
  return api.get(`/villages${qs({ district_id: districtId })}`, opts);
}

export function projects(districtId, opts) {
  return api.get(`/projects${qs({ district_id: districtId })}`, opts);
}

/* States and Union Territories, with district and case counts. The list the
   national scope selector is built from. */
export function states(opts) {
  return api.get('/states', opts);
}
