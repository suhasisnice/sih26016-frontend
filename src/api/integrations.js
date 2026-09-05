import { api, qs } from './client';

/* External land-record / cadastral integration.

   Everything here is read-only. The backend never writes an upstream value
   back onto a parcel — correcting a record is an officer's decision through
   the ordinary audited route, not something a lookup does on their behalf.

   `is_live` comes back on every response and is false for the mock. Screens
   that show upstream data must badge it: a demo that cannot tell you its
   data is simulated is a demo that is lying. */

export function providers(opts) {
  return api.get('/integrations/providers', opts);
}

/* One parcel as the portal describes it, keyed on the LGD code — the
   identifier the rest of Indian e-governance joins on. */
export function lookup({ villageLgd, surveyNumber }, opts) {
  return api.get(
    `/integrations/land-records${qs({
      village_lgd: villageLgd,
      survey_number: surveyNumber,
    })}`,
    opts,
  );
}

/* Every parcel on a case, checked against the portal. The useful half:
   which parcels the revenue record disagrees with, and why. */
export function reconcile(caseId, opts) {
  return api.get(`/integrations/reconcile${qs({ case_id: caseId })}`, opts);
}
