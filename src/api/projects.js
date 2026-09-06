import { api, qs } from './client';

/* The Projects workspace — a rollup over the cases under each project,
   computed live (required/affected area, progress, responsible officer,
   pending actions, deadline status). Distinct from api/reference.js's
   projects(), which is the plain unscoped name-only list every
   create-case/create-proposal dropdown uses; this is the heavier,
   user-scoped view for the Projects page itself. */
export function list(params, opts) {
  return api.get(`/project-workspaces${qs(params)}`, opts);
}

export function get(projectId, opts) {
  return api.get(`/project-workspaces/${projectId}`, opts);
}
