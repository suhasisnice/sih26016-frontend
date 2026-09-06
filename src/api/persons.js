import { api, qs } from './client';

/* Affected persons come back with compensation and rnr inline, each nullable.
   They stay two separate records all the way to the screen — never merged
   into one "payment" field. CLAUDE.md 2, rule 6. */
export function forCase(caseId, opts) {
  return api.get(`/persons${qs({ case_id: caseId })}`, opts);
}

export function create(payload, opts) {
  return api.post('/persons', payload, opts);
}

export function createCompensation(payload, opts) {
  return api.post('/compensation', payload, opts);
}

export function updateCompensation(compensationId, payload, opts) {
  return api.patch(`/compensation/${compensationId}`, payload, opts);
}

export function updateRnr(rnrId, payload, opts) {
  return api.patch(`/rnr/${rnrId}`, payload, opts);
}

/* The itemised benefits under one household's R&R record — housing, land,
   employment, annuity — each tracked to delivery on its own. Separate from
   updateRnr(), which only ever touches the record's overall status. */
export function rnrBenefits(rnrId, opts) {
  return api.get(`/rnr/${rnrId}/benefits`, opts);
}

export function createRnrBenefit(rnrId, payload, opts) {
  return api.post(`/rnr/${rnrId}/benefits`, payload, opts);
}

export function updateRnrBenefit(benefitId, payload, opts) {
  return api.patch(`/rnr/benefits/${benefitId}`, payload, opts);
}
