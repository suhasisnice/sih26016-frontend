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

// getUserMedia's DOMException.name maps onto one of five states in the
// effect below; each gets its own message here rather than one generic
// "camera blocked" line, since the fix for "Chrome's per-site permission
// is set to Block" is nothing like the fix for "another app already has
// the webcam open" or "this machine has no camera at all" — telling them
// apart is the whole point of catching the real error.
const CAMERA_ERROR_MESSAGE = {
  denied: 'Camera access was blocked. Check your browser’s site settings for this page (the icon in the address bar) and allow the camera, then reload.',
  unsupported: "This browser can't access a camera. Use another sign-in method below.",
  'no-device': 'No camera was found on this device. Use another sign-in method below.',
  'in-use': 'The camera is already in use by another app or browser tab. Close it and reload this page.',
  constraints: "This camera doesn't support the settings requested. Use another sign-in method below.",
};

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
  // Separate from `status`: the "keep still" animation below replaces the
  // status line entirely while a request is in flight, rather than being
  // one more string status could hold — the two can never show
  // contradictory things at once this way.
  const [checking, setChecking] = useState(false);

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
        // getUserMedia's own DOMException.name distinguishes "you said no"
        // from "there's no camera" from "something else already has it
        // open" — collapsing all three into "blocked" sends someone
        // chasing browser permission settings that were never the problem.
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraState('no-device');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraState('in-use');
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          setCameraState('constraints');
        } else {
          // NotAllowedError / PermissionDeniedError / SecurityError, and
          // anything unrecognised — genuinely a permission or origin
          // problem, or unknown enough not to guess further.
          setCameraState('denied');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // The <video> element only exists in the DOM once cameraState flips to
  // 'ready' (it's conditionally rendered below), so attaching the stream
  // has to happen here, after that mount — doing it in the effect above,
  // at the moment getUserMedia resolves, hits videoRef.current while it is
  // still null and silently does nothing, leaving the video element blank
  // forever with a live stream sitting unattached in streamRef.
  useEffect(() => {
    if (cameraState === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

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
      setChecking(true);
      try {
        const result = await authApi.faceLogin(username.trim(), frame);
        onSuccess(result);
      } catch (err) {
        // Every failure is shown verbatim now, not just a 422 capture
        // problem — a silent retry on "face not recognised" reads as the
        // camera being stuck, not as a fact about the match. The loop
        // still retries regardless; this only changes what the status
        // line says while it does.
        setStatus(err.message);
      } finally {
        busyRef.current = false;
        setChecking(false);
      }
    }, CAPTURE_INTERVAL_MS);

    return () => clearInterval(timerRef.current);
  }, [cameraState, username, onSuccess]);

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
      {checking && (
        <p className="face-card__status face-card__keepstill" role="status">
          <span>Keep still</span>
          <span className="face-card__dots" aria-hidden="true">
            <span className="face-card__dot" />
            <span className="face-card__dot" />
            <span className="face-card__dot" />
            <span className="face-card__dot" />
          </span>
        </p>
      )}
      {!checking && (
        <p className="face-card__status" role="status">
          {cameraState === 'ready' ? status || 'Look at the camera to sign in.' : ' '}
        </p>
      )}
    </div>
  );
}
