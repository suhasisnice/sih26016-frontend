import { useCallback, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import * as kioskApi from '../../api/kiosk';
import Button from '../ui/Button';
import './auth.css';

// How often the connection badge re-checks while this card is on screen —
// often enough that plugging the scanner back in updates the badge without
// a reload, rare enough it's not worth its own network log line per second.
const HEALTH_POLL_MS = 5000;

/* Talks to the local Mantra kiosk agent, never the backend directly — the
   agent does its own round trip to the backend (fetch the enrolled
   template, capture, match locally, report the result) and this component
   only ever sees its final verdict. See api/kiosk.js and
   mantra-agent/README.md.

   Unlike the face card there is no continuous loop: a fingerprint scan is
   one discrete action a person takes at the device, not something that
   silently keeps happening in the background, so this fires once on
   arriving here and again on request. */
export default function FingerprintFallback({ username, onSuccess }) {
  const [state, setState] = useState('idle'); // idle | scanning | error
  const [message, setMessage] = useState('');
  const [connection, setConnection] = useState(null); // null while checking | {connected, detail, device}

  // The Mantra Client Service only has one scanner to talk to and doesn't
  // queue overlapping requests cleanly — a health poll's GET /info landing
  // mid-capture can make a genuine in-progress scan look like a dropped
  // connection. Skipping polls while `state === 'scanning'` keeps the badge
  // from lying about a scanner that's actually mid-scan, not disconnected.
  useEffect(() => {
    if (state === 'scanning') return undefined;

    let cancelled = false;

    async function checkHealth() {
      try {
        const health = await kioskApi.agentHealth();
        if (!cancelled) setConnection(health);
      } catch (err) {
        if (!cancelled) setConnection({ connected: false, detail: err.message });
      }
    }

    checkHealth();
    const timer = setInterval(checkHealth, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state]);

  const scan = useCallback(async () => {
    if (!username || !username.trim()) {
      setState('error');
      setMessage('Enter your username above first.');
      return;
    }
    setState('scanning');
    setMessage('');
    try {
      const result = await kioskApi.agentLogin(username.trim());
      onSuccess(result);
    } catch (err) {
      setState('error');
      setMessage(err.message);
    }
  }, [username, onSuccess]);

  useEffect(() => {
    scan();
    // Deliberately once on mount only — re-running this every time
    // `scan` is recreated (i.e. every username keystroke) would fire a
    // scanner request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fingerprint-card">
      <p className={`fingerprint-card__connection${connection && !connection.connected ? ' is-disconnected' : ''}`}>
        <span className="fingerprint-card__connection-dot" aria-hidden="true" />
        {connection === null && 'Checking scanner…'}
        {connection && connection.connected &&
          (connection.device?.model
            ? `Scanner connected — ${connection.device.model} (SN ${connection.device.serial_no})`
            : 'Scanner connected')}
        {connection && !connection.connected && 'Scanner not connected'}
      </p>
      <div className={`fingerprint-card__icon${state === 'scanning' ? ' is-scanning' : ''}`}>
        <Fingerprint size={40} strokeWidth={1.5} />
      </div>
      <p className="fingerprint-card__status" role="status">
        {state === 'scanning' && 'Present your finger at the scanner…'}
        {state === 'idle' && 'Ready to scan.'}
        {state === 'error' && message}
      </p>
      <Button type="button" variant="secondary" onClick={scan} disabled={state === 'scanning'}>
        {state === 'scanning' ? 'Scanning…' : 'Scan again'}
      </Button>
    </div>
  );
}
