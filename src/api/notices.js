import { api, qs } from './client';

/* The only unauthenticated endpoint the app calls. A public notice is
   public: publication under Sections 11 and 19 is a statutory requirement,
   and a notice behind a login has not been published. */
export function list(params, opts) {
  return api.get(`/notices${qs(params)}`, opts);
}

/* The authenticated register: which statutory instruments a case has had
   published. Distinct from the public board above, which is deliberately
   narrow and carries no officer names. */
export function register(caseId, opts) {
  return api.get(`/notices/register${qs({ case_id: caseId })}`, opts);
}

export function issue(payload, opts) {
  return api.post('/notices/register', payload, opts);
}

/* A citizen's own lookup by survey number or ULPIN — unauthenticated, like
   the board above, and answers only "where does MY land stand": stage,
   award amount once declared, payment state, objection tally. No owner
   name, no phone number, no bank reference. */
export function lookup(params, opts) {
  return api.get(`/notices/lookup${qs(params)}`, opts);
}

/* "Get updates about this land" — saves a subscription against the parcel,
   independent of any account. Unauthenticated, like the lookup above. */
export function subscribe(payload, opts) {
  return api.post('/notices/subscribe', payload, opts);
}

/* Creates a landowner login for whoever owns the parcel just looked up.
   Unauthenticated by necessity — the whole point is that this is how a
   landowner gets a login in the first place. Returns {username,
   temporary_password, login_code_hint}, shown exactly once. */
export function provision(payload, opts) {
  return api.post('/notices/provision', payload, opts);
}
