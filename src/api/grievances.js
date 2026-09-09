import { api, qs } from './client';

export function list(params, opts) {
  return api.get(`/grievances${qs(params)}`, opts);
}

export function get(grievanceId, opts) {
  return api.get(`/grievances/${grievanceId}`, opts);
}

/* Multipart — file is optional, so a plain JSON body would not fit
   uploads and no-uploads through the same call. Mirrors api/documents.js's
   upload(). */
export function file({ caseId, category, subject, description, preferredContactMethod, attachment }, opts) {
  const fd = new FormData();
  fd.append('case_id', String(caseId));
  fd.append('category', category);
  fd.append('subject', subject);
  fd.append('description', description);
  if (preferredContactMethod) fd.append('preferred_contact_method', preferredContactMethod);
  if (attachment) fd.append('file', attachment);
  return api.post('/grievances', fd, opts);
}

export function respond(grievanceId, status, response, opts) {
  return api.post(`/grievances/${grievanceId}/respond`, { status, response }, opts);
}

/* Same reasoning as api/documents.js's download(): the route needs the
   bearer token, so a plain <a href> would 401. */
export async function downloadAttachment(grievanceId, filename) {
  const res = await api.raw(`/grievances/${grievanceId}/attachment`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `grievance-${grievanceId}-attachment`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
