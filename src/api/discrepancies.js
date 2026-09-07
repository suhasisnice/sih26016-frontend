import { api, qs } from './client';

/* A field officer flagging that what they found on the ground does not
   match the record. Mirrors api/objections.js's shape — see
   app.routers.discrepancies on the backend. */

export function list(params, opts) {
  return api.get(`/discrepancies${qs(params)}`, opts);
}

export function forSurveyTask(surveyTaskId, opts) {
  return api.get(`/discrepancies${qs({ survey_task_id: surveyTaskId })}`, opts);
}

export function create({ surveyTaskId, discrepancyType, description }, opts) {
  return api.post(
    '/discrepancies',
    { survey_task_id: surveyTaskId, discrepancy_type: discrepancyType, description },
    opts,
  );
}

export function respond(discrepancyId, response, opts) {
  return api.post(`/discrepancies/${discrepancyId}/respond`, { response }, opts);
}
