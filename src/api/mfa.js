import { api } from './client';

/* Authenticator-app enrollment — the Security-page side. Redeeming the
   code at login lives in api/auth.js's verifyLoginCode instead; these are
   about turning the feature on for your own account, not using it. */

export function status(opts) {
  return api.get('/mfa/status', opts);
}

export function setupTotp(opts) {
  return api.post('/mfa/totp/setup', undefined, opts);
}

export function confirmTotp(code, opts) {
  return api.post('/mfa/totp/confirm', { code }, opts);
}

export function disableTotp(opts) {
  return api.post('/mfa/totp/disable', undefined, opts);
}
