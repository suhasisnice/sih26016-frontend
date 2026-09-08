import { useState } from 'react';
import { KeyRound, ScanFace } from 'lucide-react';
import * as authApi from '../api/auth';
import * as mfaApi from '../api/mfa';
import { useApi, useMutation } from '../hooks/useApi';
import PageHeader from '../components/layout/PageHeader';
import FaceEnrollCard from '../components/auth/FaceEnrollCard';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import './security.css';

/* Every account can enroll a face — no role check on the route or on
   anything here, the same way every account owns a password.

   The authenticator card is the same idea applied to the code every
   password login now asks for: set one up here, and Login.jsx starts
   asking for its real rotating code instead of the fixed placeholder that
   applies until then — see app.services.totp on the backend for why that
   placeholder exists at all. */
export default function Security() {
  const status = useApi((opts) => authApi.biometricStatus(opts), []);
  const [reenrollingFace, setReenrollingFace] = useState(false);

  const mfaStatus = useApi((opts) => mfaApi.status(opts), []);
  // null: nothing in progress. Otherwise the /mfa/totp/setup response,
  // held in state only — the server holds the same secret in
  // totp_pending_secret, which is what /mfa/totp/confirm actually checks
  // against, so nothing here is trusted on its own.
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpMessage, setTotpMessage] = useState(null); // { tone, text }
  const startTotpSetup = useMutation(() => mfaApi.setupTotp());
  const confirmTotpSetup = useMutation((code) => mfaApi.confirmTotp(code));
  const disableTotp = useMutation(() => mfaApi.disableTotp());

  async function onStartTotpSetup() {
    setTotpMessage(null);
    try {
      setTotpSetup(await startTotpSetup.run());
    } catch (err) {
      setTotpMessage({ tone: 'error', text: err.message });
    }
  }

  async function onConfirmTotpSetup(event) {
    event.preventDefault();
    setTotpMessage(null);
    try {
      await confirmTotpSetup.run(totpCode.trim());
      setTotpSetup(null);
      setTotpCode('');
      setTotpMessage({ tone: 'success', text: 'Authenticator app enabled.' });
      mfaStatus.reload();
    } catch (err) {
      setTotpMessage({ tone: 'error', text: err.message });
    }
  }

  async function onDisableTotp() {
    setTotpMessage(null);
    try {
      await disableTotp.run();
      setTotpMessage({ tone: 'success', text: 'Authenticator app turned off.' });
      mfaStatus.reload();
    } catch (err) {
      setTotpMessage({ tone: 'error', text: err.message });
    }
  }

  return (
    <>
      <PageHeader
        title="Security"
        subtitle="Manage the face and authenticator options for your own account."
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
                <KeyRound size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="security-card__title">Authenticator app</h2>
                <p className="security-card__lede">
                  The code every password sign-in asks for next. Without one set up, that
                  step accepts a fixed placeholder instead of a real rotating code.
                </p>
              </div>
            </div>

            {mfaStatus.loading && <Loading label="Loading" rows={1} />}
            {mfaStatus.error && <ErrorState error={mfaStatus.error} onRetry={mfaStatus.reload} />}

            {mfaStatus.data && !totpSetup && (
              <div className="security-card__status">
                {mfaStatus.data.totp_enabled ? (
                  <>
                    <p className="security-card__status-text is-ok">Authenticator app is enabled.</p>
                    <Button type="button" variant="secondary" onClick={onDisableTotp} disabled={disableTotp.pending}>
                      {disableTotp.pending ? 'Turning off…' : 'Turn off'}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="primary" onClick={onStartTotpSetup} disabled={startTotpSetup.pending}>
                    {startTotpSetup.pending ? 'Starting…' : 'Set up authenticator app'}
                  </Button>
                )}
                {totpMessage && (
                  <p className={`security-card__status-text is-${totpMessage.tone}`}>{totpMessage.text}</p>
                )}
              </div>
            )}

            {totpSetup && (
              <div className="totp-setup">
                <p className="totp-setup__step">
                  Scan this with Google Authenticator, Authy or any TOTP app:
                </p>
                <img
                  src={totpSetup.qr_code}
                  alt="QR code for authenticator app setup"
                  className="totp-setup__qr"
                />
                <p className="totp-setup__step">Or enter this key manually:</p>
                <p className="totp-setup__secret">{totpSetup.secret}</p>

                <form className="totp-setup__form" onSubmit={onConfirmTotpSetup} noValidate>
                  {totpMessage && (
                    <p className={`security-card__status-text is-${totpMessage.tone}`}>{totpMessage.text}</p>
                  )}
                  <Input
                    label="Code from the app"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value)}
                  />
                  <div className="totp-setup__actions">
                    <Button type="submit" variant="primary" disabled={confirmTotpSetup.pending}>
                      {confirmTotpSetup.pending ? 'Confirming…' : 'Confirm'}
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => {
                        setTotpSetup(null);
                        setTotpCode('');
                        setTotpMessage(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
