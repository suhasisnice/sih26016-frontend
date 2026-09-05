import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, ScanFace } from 'lucide-react';
import * as authApi from '../../api/auth';
import Button from '../ui/Button';
import './auth.css';

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
   and tries a login exactly once the moment a username is filled in and
   the camera is ready.

   This used to poll /auth/login every 2.5 seconds for as long as the card
   stayed open, on the theory that "just keep trying" was the friendliest
   thing an unattended camera could do. In practice an empty chair in front
   of a kiosk, or a face that plain doesn't match, burned through the
   shared login rate limit in well under a minute with nobody watching —
   the retries kept running in the background long after they'd stopped
   being useful, and then the real next attempt (a person who actually
   showed up) got a lockout instead of a login. One attempt per username,
   then a Retry button the person has to actually click, means every
   attempt against that budget was one somebody meant to make. */
export default function FaceLoginCard({ username, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  // Which username the automatic attempt already ran for. Typing a
  // different username earns one fresh automatic try; retyping the same
  // one after a failure does not — that's what the Retry button is for.
  const autoAttemptedForRef = useRef(null);

  const [cameraState, setCameraState] = useState('starting'); // starting | ready | denied | unsupported
  const [status, setStatus] = useState('');
  // Separate from `status`: the "keep still" animation below replaces the
  // status line entirely while a request is in flight, rather than being
  // one more string status could hold — the two can never show
  // contradictory things at once this way.
  const [checking, setChecking] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const attemptLogin = useCallback(async () => {
    if (busyRef.current) return;
    if (!username || !username.trim()) {
      setStatus('Enter your username above, then look at the camera.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    busyRef.current = true;
    setCanRetry(false);

    // The stream's first real frame can lag a beat behind cameraState
    // flipping to 'ready'. The old polling loop covered this for free by
    // just trying again next tick; a one-shot attempt waits out that same
    // brief window itself instead of failing on a technicality.
    let waited = 0;
    while (video.readyState < 2 && waited < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waited += 100;
    }
    if (!mountedRef.current) return;
    if (video.readyState < 2) {
      setStatus("Couldn't read the camera. Try again.");
      setCanRetry(true);
      busyRef.current = false;
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const frame = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    setChecking(true);
    try {
      const result = await authApi.faceLogin(username.trim(), frame);
      onSuccess(result);
    } catch (err) {
      if (!mountedRef.current) return;
      // Shown verbatim, whatever it says — "face not recognised" and a
      // rate-limit message are both real facts about what just happened,
      // not something to hide behind a blank line while quietly retrying.
      setStatus(err.message);
      setCanRetry(true);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setChecking(false);
    }
  }, [username, onSuccess]);

  // The one automatic attempt: fires once the camera is ready and a
  // username has been typed. Everything after that — including trying
  // again with the exact same username — is the Retry button, never this
  // effect firing a second time on its own.
  useEffect(() => {
    if (cameraState !== 'ready') return;
    const trimmed = username && username.trim();
    if (!trimmed || autoAttemptedForRef.current === trimmed) return;
    autoAttemptedForRef.current = trimmed;
    attemptLogin();
  }, [cameraState, username, attemptLogin]);

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
          {cameraState === 'ready' ? status || 'Look at the camera to sign in.' : ' '}
        </p>
      )}
      {!checking && canRetry && cameraState === 'ready' && (
        <Button type="button" variant="secondary" size="sm" onClick={attemptLogin}>
          Retry
        </Button>
      )}
    </div>
  );
}
