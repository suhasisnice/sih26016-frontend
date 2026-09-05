import { useEffect, useRef, useState } from 'react';
import { CameraOff, ScanFace } from 'lucide-react';
import * as authApi from '../../api/auth';
import './auth.css';

// How often a frame is captured and sent while the camera is live. Short
// enough that signing in feels immediate once a face is actually in frame,
// long enough that a few seconds of bad lighting or an empty chair in
// front of the kiosk doesn't burn through /auth/login's shared
// rate-limit budget before a real attempt gets a turn.
const CAPTURE_INTERVAL_MS = 2500;

/* The camera card. Requests the webcam once mounted, shows the live feed,
   and quietly tries a login every CAPTURE_INTERVAL_MS as long as a
   username is filled in — there is no separate "capture" button to click,
   since the entire point of this factor is that looking at the camera is
   the whole action.

   Every failure here is shown as a small status line, never a blocking
   error banner: "no face detected" and "face not recognised" are both
   just the state between camera-on and signed-in, not something the
   person did wrong. */
export default function FaceLoginCard({ username, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const timerRef = useRef(null);

  const [cameraState, setCameraState] = useState('starting'); // starting | ready | denied | unsupported
  const [status, setStatus] = useState('');

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
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraState('ready');
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cameraState !== 'ready') return undefined;

    timerRef.current = setInterval(async () => {
      if (busyRef.current) return;
      if (!username || !username.trim()) {
        setStatus('Enter your username above, then look at the camera.');
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const frame = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

      busyRef.current = true;
      setStatus('Checking…');
      try {
        const result = await authApi.faceLogin(username.trim(), frame);
        onSuccess(result);
      } catch (err) {
        // 422 = a capture problem (no face / too many faces / blurry) and
        // is shown verbatim, since it tells the person what to change.
        // Everything else (401 not-recognised, 429 rate-limited) gets a
        // steady, unalarming line — this loop will just try again.
        setStatus(err.code === 'validation_error' || err.status === 422 ? err.message : ' ');
      } finally {
        busyRef.current = false;
      }
    }, CAPTURE_INTERVAL_MS);

    return () => clearInterval(timerRef.current);
  }, [cameraState, username, onSuccess]);

  return (
    <div className="face-card">
      <div className="face-card__frame">
        {cameraState === 'ready' && (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
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
            <CameraOff size={32} strokeWidth={1.5} />
            <span>
              {cameraState === 'denied'
                ? 'Camera access was blocked. Allow it in your browser, or use another sign-in method below.'
                : "This browser can't access a camera. Use another sign-in method below."}
            </span>
          </div>
        )}
        <canvas ref={canvasRef} className="face-card__canvas" aria-hidden="true" />
      </div>
      <p className="face-card__status" role="status">
        {cameraState === 'ready' ? status || 'Look at the camera to sign in.' : ' '}
      </p>
    </div>
  );
}
