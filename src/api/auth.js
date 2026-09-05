import { api } from './client';

/* POST /auth/login is OAuth2 password flow: form-encoded username/password,
   returning {access_token, token_type, user}. */
export function login(username, password) {
  return api.postForm('/auth/login', { username, password });
}

export function me(opts) {
  return api.get('/auth/me', opts);
}

/* The invitation is checked before the form is filled, so the person can see
   which role and district the code grants them rather than discovering it
   after they have chosen a password. Unauthenticated by necessity — they
   have no account yet. */
export function previewInvite(inviteCode, opts) {
  return api.post('/auth/invite/preview', { invite_code: inviteCode }, opts);
}

export function register(payload, opts) {
  return api.post('/auth/register', payload, opts);
}
