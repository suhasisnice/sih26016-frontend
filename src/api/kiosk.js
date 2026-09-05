/* The local Mantra kiosk agent — see lib/constants.js's KIOSK_AGENT_URL.
   A different origin from api/client.js's BASE on purpose: this process
   runs on the kiosk PC itself, never through the backend, so it needs its
   own small fetch wrapper rather than reusing one built around Bearer
   tokens and the backend's error shape. */

import { ApiError } from './client';
import { KIOSK_AGENT_URL } from '../lib/constants';

async function request(path, body) {
  let res;
  try {
    res = await fetch(`${KIOSK_AGENT_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  } catch {
    // The overwhelmingly common case: no agent running on this machine at
    // all, because it isn't a kiosk. Worded as a fact, not a fault — a
    // landowner on their own laptop should read this and understand why,
    // not wonder what broke.
    throw new ApiError(
      'No fingerprint scanner found on this device. Use face recognition or a password instead.',
      'agent_unreachable',
      0,
    );
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* an empty or non-JSON body is handled below by res.ok */
  }

  if (!res.ok) {
    throw new ApiError(
      (data && data.detail) || 'The fingerprint scanner could not complete that request.',
      'agent_error',
      res.status,
    );
  }
  return data;
}

/* Runs the whole fingerprint login round trip on the kiosk agent's side —
   fetch the enrolled template from the backend, capture, match locally
   against Mantra's own MFS100MatchISO, report the result back to the
   backend — and returns the same {access_token, token_type, user} shape
   /auth/login does, or throws. See mantra-agent/main.py. */
export function agentLogin(username) {
  return request('/login', { username });
}

/* Captures one fingerprint locally, for enrollment. Returns
   {template_base64} to be forwarded to POST /biometrics/fingerprint/enroll
   — enrollment always goes through the backend directly, authenticated as
   the signed-in officer, never through the agent's own login path. */
export function agentCapture() {
  return request('/capture', {});
}
