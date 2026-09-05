import { useEffect, useRef, useState } from 'react';
import { CameraOff, Check, ScanFace } from 'lucide-react';
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

/* FaceEnrollCard's sibling for a screen with no account yet to enroll
   against. Registration is one request the account doesn't exist before —
   there is nothing to call POST /biometrics/face/enroll with a bearer
   token for — so this only captures a frame and hands it to the parent via
   onCapture. Signup.jsx holds onto it and enrolls it itself, in the moment
   right after registration succeeds and it has a fresh token. */
export default function FaceCaptureCard({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraState, setCameraState] = useState('starting'); // starting | ready | denied | unsupported
  const [captured, setCaptured] = useState(false);

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

  // See FaceEnrollCard.jsx — the <video> only mounts once cameraState is
  // 'ready', so the stream has to be attached here rather than at the
  // moment getUserMedia resolves.
  useEffect(() => {
    if (cameraState === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const frame = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    setCaptured(true);
    onCapture(frame);
  }

  function retake() {
    setCaptured(false);
    onCapture(null);
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

      <p className="face-card__status" role="status">
        {captured
          ? ' '
          : cameraState === 'ready'
            ? 'Centre your face in the frame, then capture.'
            : ' '}
      </p>

      {captured ? (
        <div className="face-capture__done">
          <span className="face-capture__done-badge">
            <Check size={14} strokeWidth={2} aria-hidden="true" />
            Face captured
          </span>
          <Button type="button" variant="quiet" size="sm" onClick={retake}>
            Retake
          </Button>
        </div>
      ) : (
        <Button type="button" variant="primary" onClick={captureFrame} disabled={cameraState !== 'ready'}>
          Capture
        </Button>
      )}
    </div>
  );
}
