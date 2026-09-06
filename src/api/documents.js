import { api, qs } from './client';

export function forCase(caseId, opts) {
  return api.get(`/documents${qs({ case_id: caseId })}`, opts);
}

/* What the current stage legally requires versus what has been filed.
   Returns {case_id, stage, required, present, missing}. */
export function missing(caseId, opts) {
  return api.get(`/documents/missing${qs({ case_id: caseId })}`, opts);
}

export function upload({ caseId, docType, file }, opts) {
  const fd = new FormData();
  fd.append('case_id', String(caseId));
  fd.append('doc_type', docType);
  fd.append('file', file);
  return api.post('/documents', fd, opts);
}

/* Downloads go through fetch rather than a bare href because the route needs
   the bearer token. The blob URL is revoked by the caller. */
export async function download(documentId, filename) {
  const res = await api.raw(`/documents/${documentId}/download`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `document-${documentId}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Every version of one document type on a case, newest first. The revision
   chain behind a single row in the document list. */
export function versions(caseId, docType, opts) {
  return api.get(`/documents/versions${qs({ case_id: caseId, doc_type: docType })}`, opts);
}

/* VERIFY / REJECT / SEND FOR CORRECTION. A note is required for anything
   but "verified" — the backend refuses the request without one, this just
   forwards whatever the modal collected. */
export function verify(documentId, status, note, opts) {
  return api.post(`/documents/${documentId}/verify`, { status, note: note || null }, opts);
}
