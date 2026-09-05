import { useEffect } from 'react';
import './auth.css';

/* The beat between "that credential checked out" and actually landing on
   the dashboard — every sign-in path (face, fingerprint, password plus a
   code) routes through this instead of navigating the instant it
   succeeds, the same way a UPI app holds on its green check for a moment
   before it lets go of the payment screen. Skipping straight to the next
   page reads as "did that actually work?"; a deliberate, unmissable
   confirmation reads as done.

   Purely a beat, not a decision point — there is nothing to click here.
   onDone fires once, after `duration`, and the caller navigates. */
export default function LoginSuccessOverlay({ label, onDone, duration = 1500 }) {
  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="login-success" role="status" aria-live="polite">
      <svg className="login-success__ring" viewBox="0 0 80 80" aria-hidden="true">
        <circle className="login-success__circle" cx="40" cy="40" r="36" />
        <path className="login-success__check" d="M24 41 L35 52 L57 28" />
      </svg>
      <p className="login-success__label">{label}</p>
    </div>
  );
}
