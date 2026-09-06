import { api } from './client';

/* Step-up: re-confirming an ALREADY signed-in officer's identity before
   one high-impact action (a case hold, or advancing into Declaration,
   Award, Possession, or the case's final stage) — never a login. See
   components/case/StepUpConfirmModal.jsx for where these are called from,
   and mantra-agent/main.py's /stepup endpoint for the fingerprint half
   that runs on the kiosk itself. */

export function faceStepUp(imageBase64, opts) {
  return api.post('/biometrics/face/stepup', { image_base64: imageBase64 }, opts);
}

export function fingerprintStepUpStart(opts) {
  return api.post('/biometrics/fingerprint/stepup/start', {}, opts);
}
