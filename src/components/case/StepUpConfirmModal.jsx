import { useEffect, useRef, useState } from 'react';
import { ScanFace } from 'lucide-react';
import * as biometricsApi from '../../api/biometrics';
import { useMutation } from '../../hooks/useApi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import '../auth/auth.css';

/* "Confirm Officer Identity" — a fresh face check before one specific
   high-impact action (a case hold, or advancing into Declaration, Award,
   Possession, or the case's final stage), never a login. The backend
   decides which actions need this (STEPUP_REQUIRED_STAGES in
   app/routers/cases.py); this component's only job is producing a
   stepup_token and handing it to whichever mutation asked for one.

   Landowners never see this: it is only ever opened from an officer action
   already gated by role. */
export default function StepUpConfirmModal({ open, onClose, onVerified }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm officer identity"
      subtitle="This action needs a fresh identity check before it takes effect."
    >
      <FaceStepUp onVerified={onVerified} />
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
            <span>Camera unavailable. Check your browser's camera permission and try again.</span>
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
