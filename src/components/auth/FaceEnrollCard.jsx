import { useEffect, useRef, useState } from 'react';
import { CameraOff, ScanFace } from 'lucide-react';
import * as authApi from '../../api/auth';
import Button from '../ui/Button';
import './auth.css';

// See FaceLoginCard.jsx's identical constant for why getUserMedia's
// DOMException.name gets its own message per cause instead of one
// generic "camera blocked" line.
const CAMERA_ERROR_MESSAGE = {
  denied: 'Camera access was blocked. Check your browser’s site settings for this page (the icon in the address bar) and allow the camera, then reload.',
  unsupported: "This browser can't access a camera.",
  'no-device': 'No camera was found on this device.',
  'in-use': 'The camera is already in use by another app or browser tab. Close it and reload this page.',
  constraints: "This camera doesn't support the settings requested.",
};

/* Enrollment's camera card, not FaceLoginCard's. Login fires a capture
   silently every couple of seconds because the point of that screen is to
   need no action at all; enrollment is the opposite — a deliberate "take
   this photo of me now" moment, so it waits for a click rather than
   guessing when the person is ready, and never fires a second request
   while one is already in flight. */
export default function FaceEnrollCard({ onEnrolled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraState, setCameraState] = useState('starting'); // starting | ready | denied | unsupported
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'error' | 'success', text }

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
      } catch (err) {
        if (cancelled) return;
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraState('no-device');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraState('in-use');
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          setCameraState('constraints');
        } else {
          setCameraState('denied');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // The <video> element only exists in the DOM once cameraState flips to
  // 'ready' (it's conditionally rendered below), so attaching the stream
  // has to happen here, after that mount — doing it at the moment
  // getUserMedia resolves hits videoRef.current while it is still null and
  // silently does nothing, leaving the video element blank forever.
  useEffect(() => {
    if (cameraState === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

  async function captureAndEnroll() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || pending) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const frame = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    setPending(true);
    setMessage(null);
    try {
      const result = await authApi.enrollFace(frame);
      setMessage({ tone: 'success', text: 'Face enrolled. You can sign in with it from now on.' });
      onEnrolled(result);
    } catch (err) {
      // 422 = a capture problem (no face / too many faces / blurry) — shown
      // verbatim, since it says exactly what to change before trying again.
      setMessage({
        tone: 'error',
        text: err.status === 422 ? err.message : err.message || 'Enrollment failed. Try again.',
      });
    } finally {
      setPending(false);
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
        {CAMERA_ERROR_MESSAGE[cameraState] && (
          <div className="face-card__placeholder">
            <CameraOff size={32} strokeWidth={1.5} />
            <span>{CAMERA_ERROR_MESSAGE[cameraState]}</span>
          </div>
        )}
        <canvas ref={canvasRef} className="face-card__canvas" aria-hidden="true" />
      </div>

      <p className={`face-card__status${message && message.tone === 'error' ? ' is-error' : ''}`} role="status">
        {message ? message.text : cameraState === 'ready' ? 'Centre your face in the frame, then capture.' : ' '}
      </p>

      <Button
        type="button"
        variant="primary"
        onClick={captureAndEnroll}
        disabled={cameraState !== 'ready' || pending}
      >
        {pending ? 'Enrolling…' : 'Capture and enroll'}
      </Button>
    </div>
  );
}
