import { api, qs } from './client';

export function list(params, opts) {
  return api.get(`/objections${qs(params)}`, opts);
}

export function forCase(caseId, opts) {
  return api.get(`/objections${qs({ case_id: caseId })}`, opts);
}

/* There is no GET /objections/{id} — the list route returns every objection
   in the caller's scope and nothing else takes an id. Reusing it here rather
   than adding a single-fetch endpoint for one detail screen: the list is
   already unpaginated and already scoped, so this costs the same request the
   list page itself makes. */
export async function get(objectionId, opts) {
  const { items } = await list({}, opts);
  const found = items.find((item) => String(item.id) === String(objectionId));
  if (!found) {
    const error = new Error('That objection could not be found.');
    error.code = 'not_found';
    error.status = 404;
    throw error;
  }
  return found;
}

export function create(payload, opts) {
  return api.post('/objections', payload, opts);
}

/* Officer response and outcome. POST .../respond, not PATCH on the objection. */
export function respond(objectionId, { status, response }, opts) {
  return api.post(`/objections/${objectionId}/respond`, { status, response }, opts);
}
