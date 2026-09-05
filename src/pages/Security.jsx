import { useState } from 'react';
import { Fingerprint, ScanFace } from 'lucide-react';
import * as authApi from '../api/auth';
import * as kioskApi from '../api/kiosk';
import { useApi, useMutation } from '../hooks/useApi';
import PageHeader from '../components/layout/PageHeader';
import FaceEnrollCard from '../components/auth/FaceEnrollCard';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import './security.css';

/* Every account can enroll a face — no role check on the route or on
   anything here, the same way every account owns a password. Fingerprint
   only ever works from a kiosk with a Mantra scanner physically attached,
   so its section treats "no agent on this machine" as the ordinary case
   a landowner or officer at a normal desk will see, not a fault. */
export default function Security() {
  const status = useApi((opts) => authApi.biometricStatus(opts), []);
  const [reenrollingFace, setReenrollingFace] = useState(false);

  const [fingerprintMessage, setFingerprintMessage] = useState(null); // { tone, text }
  const [reenrollingFingerprint, setReenrollingFingerprint] = useState(false);
  const scanFingerprint = useMutation(async () => {
    const { template_base64: template } = await kioskApi.agentCapture();
    return authApi.enrollFingerprint(template);
  });

  async function onScanFingerprint() {
    setFingerprintMessage(null);
    try {
      await scanFingerprint.run();
      setFingerprintMessage({ tone: 'success', text: 'Fingerprint enrolled for kiosk sign-in.' });
      setReenrollingFingerprint(false);
      status.reload();
    } catch (err) {
      // agent_unreachable is the expected state on any machine without a
      // kiosk scanner attached — worded as a fact, shown the same as the
      // login screen's fallback, never as a red error banner.
      setFingerprintMessage({
        tone: err.code === 'agent_unreachable' ? 'info' : 'error',
        text: err.message,
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Security"
        subtitle="Manage the face and fingerprint sign-in options for your own account."
      />

      {status.loading && <Loading label="Loading your security settings" rows={4} />}
      {status.error && <ErrorState error={status.error} onRetry={status.reload} />}

      {status.data && (
        <div className="security-grid">
          <section className="security-card">
            <div className="security-card__head">
              <span className="security-card__icon" aria-hidden="true">
                <ScanFace size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="security-card__title">Face sign-in</h2>
                <p className="security-card__lede">
                  Look at the camera to sign in instead of typing your password.
                </p>
              </div>
            </div>

            {status.data.face_enrolled && !reenrollingFace ? (
              <div className="security-card__status">
                <p className="security-card__status-text is-ok">Face recognition is enrolled.</p>
                <Button type="button" variant="secondary" onClick={() => setReenrollingFace(true)}>
                  Re-enroll with a new photo
                </Button>
              </div>
            ) : (
              <FaceEnrollCard
                onEnrolled={() => {
                  setReenrollingFace(false);
                  status.reload();
                }}
              />
            )}
          </section>

          <section className="security-card">
            <div className="security-card__head">
              <span className="security-card__icon" aria-hidden="true">
                <Fingerprint size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="security-card__title">Fingerprint sign-in</h2>
                <p className="security-card__lede">
                  Only works at a kiosk with a Mantra fingerprint scanner attached.
                </p>
              </div>
            </div>

            {status.data.fingerprint_enrolled && !reenrollingFingerprint ? (
              <div className="security-card__status">
                <p className="security-card__status-text is-ok">Fingerprint is enrolled.</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setReenrollingFingerprint(true);
                    setFingerprintMessage(null);
                  }}
                >
                  Re-enroll with a new scan
                </Button>
              </div>
            ) : (
              <div className="security-card__status">
                <Button
                  type="button"
                  variant="primary"
                  onClick={onScanFingerprint}
                  disabled={scanFingerprint.pending}
                >
                  {scanFingerprint.pending ? 'Scanning…' : 'Scan and enroll fingerprint'}
                </Button>
                {fingerprintMessage && (
                  <p className={`security-card__status-text is-${fingerprintMessage.tone}`}>
                    {fingerprintMessage.text}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
