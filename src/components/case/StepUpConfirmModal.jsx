import { useEffect, useRef, useState } from 'react';
import { Fingerprint, ScanFace } from 'lucide-react';
import * as biometricsApi from '../../api/biometrics';
import * as kioskApi from '../../api/kiosk';
import { useMutation } from '../../hooks/useApi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import '../auth/auth.css';

/* "Confirm Officer Identity" — a fresh face or fingerprint check before one
   specific high-impact action (a case hold, or advancing into Declaration,
   Award, Possession, or the case's final stage), never a login. The
   backend decides which actions need this (STEPUP_REQUIRED_STAGES in
   app/routers/cases.py); this component's only job is producing a
   stepup_token and handing it to whichever mutation asked for one.

   Two methods, same shape as Login.jsx's own precedence — face first
   (needs only this machine's camera), fingerprint as the fallback (needs a
   kiosk with a Mantra scanner attached). Landowners never see this: it is
   only ever opened from an officer action already gated by role. */
export default function StepUpConfirmModal({ open, onClose, onVerified }) {
  const [method, setMethod] = useState('face');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm officer identity"
      subtitle="This action needs a fresh identity check before it takes effect."
    >
      <div className="login-role-tabs" role="tablist" aria-label="Verification method">
        <button
          type="button"
          role="tab"
          aria-selected={method === 'face'}
          className={`login-role-tabs__tab${method === 'face' ? ' is-active' : ''}`}
          onClick={() => setMethod('face')}
        >
          Face verification
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === 'fingerprint'}
          className={`login-role-tabs__tab${method === 'fingerprint' ? ' is-active' : ''}`}
          onClick={() => setMethod('fingerprint')}
        >
          Fingerprint
        </button>
      </div>

      {method === 'face' ? (
        <FaceStepUp onVerified={onVerified} />
      ) : (
        <FingerprintStepUp onVerified={onVerified} />
      )}
    </Modal>
  );
}

/* A one-shot camera capture, not FaceLoginCard's continuous polling loop —
   the same reasoning FaceEnrollCard's own docstring gives: this is a
   deliberate "confirm it's me, right now" moment, not something that
   should silently keep trying in the background. */
function FaceStepUp({ onVerified }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraState, setCameraState] = useState('starting'); // starting | ready | denied | unsupported
  const stepup = useMutation((frame) => biometricsApi.faceStepUp(frame));

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setCameraState('ready');
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    }

    start();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // See FaceLoginCard.jsx's identical effect for why this can't happen at
  // the moment getUserMedia resolves: the <video> element doesn't exist
  // in the DOM until cameraState is 'ready'.
  useEffect(() => {
    if (cameraState === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

  async function onCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const frame = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    try {
      const result = await stepup.run(frame);
      onVerified(result.stepup_token);
    } catch {
      /* stepup.error already carries the message to show */
    }
  }

  return (
    <div className="face-card">
      <div className="face-card__frame">
        {cameraState === 'ready' && (
          <video ref={videoRef} autoPlay playsInline muted className="face-card__video" />
        )}
        {cameraState === 'starting' && (
          <div className="face-card__placeholder">
            <ScanFace size={32} strokeWidth={1.5} />
            <span>Starting camera…</span>
          </div>
        )}
        {(cameraState === 'denied' || cameraState === 'unsupported') && (
          <div className="face-card__placeholder">
            <ScanFace size={32} strokeWidth={1.5} />
            <span>Camera unavailable. Try fingerprint instead.</span>
          </div>
        )}
        <canvas ref={canvasRef} className="face-card__canvas" aria-hidden="true" />
      </div>

      {stepup.error && (
        <p className="face-card__status is-error" role="alert">
          {stepup.error.message}
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        onClick={onCapture}
        disabled={cameraState !== 'ready' || stepup.pending}
      >
        {stepup.pending ? 'Verifying…' : 'Capture and confirm'}
      </Button>
    </div>
  );
}

/* Talks to the local Mantra kiosk agent — see api/kiosk.js's agentStepUp
   and mantra-agent/main.py's /stepup. Unlike login's FingerprintFallback,
   this component fetches its own challenge (it already knows who is
   asking; there is no username to type), then hands the nonce and
   enrolled template straight to the kiosk. */
function FingerprintStepUp({ onVerified }) {
  const [state, setState] = useState('idle'); // idle | scanning | error
  const [message, setMessage] = useState('');

  async function onScan() {
    setState('scanning');
    setMessage('');
    try {
      const challenge = await biometricsApi.fingerprintStepUpStart();
      const result = await kioskApi.agentStepUp(challenge.nonce, challenge.template_base64);
      onVerified(result.stepup_token);
    } catch (err) {
      setState('error');
      setMessage(err.message);
    }
  }

  return (
    <div className="fingerprint-card">
      <div className={`fingerprint-card__icon${state === 'scanning' ? ' is-scanning' : ''}`}>
        <Fingerprint size={40} strokeWidth={1.5} />
      </div>
      <p className="fingerprint-card__status" role="status">
        {state === 'scanning' && 'Present your finger at the scanner…'}
        {state === 'idle' && 'Ready to scan.'}
        {state === 'error' && message}
      </p>
      <Button type="button" variant="secondary" onClick={onScan} disabled={state === 'scanning'}>
        {state === 'scanning' ? 'Scanning…' : 'Scan to confirm'}
      </Button>
    </div>
  );
}
