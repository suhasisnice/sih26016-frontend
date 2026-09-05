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
