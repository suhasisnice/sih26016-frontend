import { api, qs } from './client';

/* Field survey tasks: assignment through submission and review. Mirrors
   app.routers.survey one endpoint at a time. */

export function list(params, opts) {
  return api.get(`/survey-tasks${qs(params)}`, opts);
}

export function get(taskId, opts) {
  return api.get(`/survey-tasks/${taskId}`, opts);
}

/* Omitting assignedToUserId self-starts it (status goes straight to
   in_progress); passing it is a supervisor assigning a named officer
   (status starts at assigned). */
export function create({ caseId, parcelId, assignedToUserId, dueOn, notes }, opts) {
  return api.post(
    '/survey-tasks',
    {
      case_id: caseId,
      parcel_id: parcelId || null,
      assigned_to_user_id: assignedToUserId || null,
      due_on: dueOn || null,
      notes: notes || null,
    },
    opts,
  );
}

export function start(taskId, opts) {
  return api.post(`/survey-tasks/${taskId}/start`, undefined, opts);
}

/* Every field optional — the entry portal saves whatever it has, one
   section at a time, without restating the rest. */
export function save(taskId, payload, opts) {
  return api.patch(`/survey-tasks/${taskId}`, payload, opts);
}

export function uploadPhoto({ taskId, file, latitude, longitude, caption }, opts) {
  const fd = new FormData();
  fd.append('file', file);
  if (latitude != null) fd.append('latitude', String(latitude));
  if (longitude != null) fd.append('longitude', String(longitude));
  if (caption) fd.append('caption', caption);
  return api.post(`/survey-tasks/${taskId}/photos`, fd, opts);
}

export function deletePhoto(taskId, photoId, opts) {
  return api.delete(`/survey-tasks/${taskId}/photos/${photoId}`, opts);
}

export function submit(taskId, opts) {
  return api.post(`/survey-tasks/${taskId}/submit`, undefined, opts);
}

export function approve(taskId, reviewNote, opts) {
  return api.post(`/survey-tasks/${taskId}/approve`, { review_note: reviewNote || null }, opts);
}

export function returnForCorrection(taskId, reviewNote, opts) {
  return api.post(`/survey-tasks/${taskId}/return`, { review_note: reviewNote }, opts);
}

/* Field officers in one district, for the assign-survey picker. */
export function assignableOfficers(districtId, opts) {
  return api.get(`/survey-tasks/officers${qs({ district_id: districtId })}`, opts);
}
