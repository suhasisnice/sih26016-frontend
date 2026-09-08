import { api } from './client';

/* Step-up: re-confirming an ALREADY signed-in officer's identity before
   one high-impact action (a case hold, or advancing into Declaration,
   Award, Possession, or the case's final stage) — never a login. See
   components/case/StepUpConfirmModal.jsx for where this is called from. */

export function faceStepUp(imageBase64, opts) {
  return api.post('/biometrics/face/stepup', { image_base64: imageBase64 }, opts);
}
