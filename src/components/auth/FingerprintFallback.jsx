import { useCallback, useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import * as kioskApi from '../../api/kiosk';
import Button from '../ui/Button';
import './auth.css';

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
