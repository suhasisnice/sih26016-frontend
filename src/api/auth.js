import { api } from './client';

/* POST /auth/login is OAuth2 password flow: form-encoded username/password,
   returning {access_token, token_type, user}. */
/* Every password login now returns {mfa_required, mfa_token, totp_enabled}
   instead of a token directly — verifyLoginCode redeems that mfa_token for
   the real session once the code step passes. */
export function login(username, password) {
  return api.postForm('/auth/login', { username, password });
}

export function verifyLoginCode(mfaToken, code, opts) {
  return api.post('/auth/login/verify', { mfa_token: mfaToken, code }, opts);
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

/* Face and kiosk-fingerprint. Enrollment and status are authenticated —
   something you do to your own already-signed-in account — while
   face-login is not, for the same reason /auth/login isn't: the whole
   point is to establish a session, not use one. */

export function biometricStatus(opts) {
  return api.get('/biometrics/status', opts);
}

export function enrollFace(imageBase64, opts) {
  return api.post('/biometrics/face/enroll', { image_base64: imageBase64 }, opts);
}

export function faceLogin(username, imageBase64, opts) {
  return api.post('/biometrics/face/login', { username, image_base64: imageBase64 }, opts);
}

export function enrollFingerprint(templateBase64, opts) {
  return api.post('/biometrics/fingerprint/enroll', { template_base64: templateBase64 }, opts);
}
