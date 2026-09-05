import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, User, UserCheck2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isLandowner } from '../auth/permissions';
import * as authApi from '../api/auth';
import { roleLabel } from '../lib/labels';
import { required, validate } from '../lib/validate';
import { setToken } from '../api/client';
import Button from '../components/ui/Button';
import PublicHeader from '../components/public/PublicHeader';
import FaceLoginCard from '../components/auth/FaceLoginCard';
import FingerprintFallback from '../components/auth/FingerprintFallback';
import '../components/public/public.css';
import '../components/auth/auth.css';
import './login.css';

/* Built to the Figma "login-page" frame's split card, with three deliberate
   departures from it:

   - The frame asks for a User-ID field and an Email-ID field as well as a
     password. This system issues one credential per officer — a username —
     and the API takes exactly that plus a password, so a second identity
     field would be asking for information nothing downstream uses.
   - The frame's Land Owner / Officer toggle picks between two roles. Here
     it decides something real: which sign-in methods even apply. A
     landowner's account has no camera or scanner enrolled against it and
     never will — their credential is a username and a password issued by
     the district office, full stop — so the toggle switches straight to
     that form with nothing else offered. An officer instead gets a fixed
     precedence order, not a menu: face recognition first, a quiet
     "issues with face?" link down to the kiosk fingerprint scanner,
     and — if that has issues too — a further link down to username and
     password. Nobody has to know which factor "suits their desk"; the
     system just tries the strongest one first and steps down.
   - The floor of that chain is two steps now, not one: password, then a
     code. POST /auth/login never returns a token any more, only an
     mfa_token good for the follow-up at /auth/login/verify — an
     authenticator app's real rotating code if one is enrolled, or a fixed
     placeholder if it isn't yet (see app.services.totp on the backend for
     why that placeholder exists and how temporary it's meant to be). */

/* The demo account list publishes working credentials — six usernames and
   the password they share, one of them a State Administrator. That is
   exactly right for a local demo and a serious hole on a public URL, so it
   is opt-in rather than opt-out: it renders only when
   VITE_SHOW_DEMO_ACCOUNTS is explicitly "true".

   Opt-in, not `import.meta.env.DEV`, because the judging build is a
   production build that still wants the list — tying it to DEV would mean
   either shipping credentials publicly or losing them exactly where they
   are needed. */
const SHOW_DEMO_ACCOUNTS = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

/* Whatever SEED_PASSWORD the database was seeded with. Only ever read when
   the list above is showing, which is local-only — so the default is the
   local seed default, and a deployment that reseeded with its own password
   sets this to match rather than showing credentials that no longer work. */
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'demo1234';

const ACCOUNTS = [
  { username: 'dc.bengaluru', role: 'district_officer', tab: 'officer' },
  { username: 'slao.bengaluru', role: 'slao', tab: 'officer' },
  { username: 'rnr.bengaluru', role: 'rnr_officer', tab: 'officer' },
  { username: 'field.bengaluru', role: 'field_officer', tab: 'officer' },
  { username: 'admin', role: 'admin', tab: 'officer' },
  { username: 'landowner', role: 'landowner', tab: 'landowner' },
];

const TRUST = [
  {
    icon: ShieldCheck,
    heading: 'Secure',
    detail: 'Your data is protected',
  },
  {
    icon: UserCheck2,
    heading: 'Trusted',
    detail: 'Used by officials nationwide',
  },
  {
    icon: Lock,
    heading: 'Reliable',
    detail: 'Always available when you need us',
  },
];

export default function Login() {
  const { login, verifyMfaCode, adopt, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* Set once the password step passes — its presence is what switches the
     password form over to the code form below, for both the landowner
     path and the officer password-fallback path, since both share
     passwordForm and now share mfaCodeForm the same way. */
  const [mfaToken, setMfaToken] = useState(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState(null);
  const [mfaPending, setMfaPending] = useState(false);

  /* Set once a login succeeds but the account's password was
     BhoomiMitra-generated (see Notices.jsx's ProvisionSection) rather than
     chosen by the person — the session is already real at this point
     (verifyMfaCode/onBiometricSuccess already stored the token), but the
     redirect-when-signed-in effect below is held off until this clears, so
     the forced reset step below is shown instead of the dashboard. */
  const [pendingReset, setPendingReset] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState(null);
  const [resetPending, setResetPending] = useState(false);

  /* Who is signing in — decides which methods are even on offer, not just
     which demo accounts are listed. */
  const [accountKind, setAccountKind] = useState('landowner');
  /* Where an officer is in the precedence order — 'face', then
     'fingerprint', then 'password', moved down one at a time by the
     "issues with X?" link under whichever is showing. Starts at the top
     every time; there's no memory of "this desk has no camera" yet. A
     landowner never has a mode at all — there is only ever the one method
     for that account kind. */
  const [mode, setMode] = useState('face');
  // Enter in the username field below calls faceCardRef.current.submitNow()
  // — the fast path past FaceLoginCard's own debounce, for anyone who
  // typed a full username they're confident in.
  const faceCardRef = useRef(null);

  const from = location.state && location.state.from;

  /* Where a role belongs after signing in. A landowner has no dashboard, so
     sending them to one would bounce them straight to NotAuthorised. */
  const landingFor = useCallback(
    (who) => {
      if (from) return from;
      return isLandowner(who) ? '/cases' : '/dashboard';
    },
    [from],
  );

  useEffect(() => {
    // Already signed in and arriving at /login — send them where they belong
    // rather than showing a form they do not need. Held off while a forced
    // password reset is pending: the session is already real by that point,
    // but the person still has to replace a generated password before
    // anything else, so this effect would otherwise redirect straight past
    // that screen the moment it appears.
    if (user && !pendingReset) navigate(landingFor(user), { replace: true });
  }, [user, pendingReset, navigate, landingFor]);

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  function chooseAccountKind(kind) {
    setAccountKind(kind);
    setMode('face');
    setFailure(null);
    resetMfaStep();
  }

  function resetMfaStep() {
    setMfaToken(null);
    setMfaCode('');
    setMfaError(null);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFailure(null);

    const result = validate(values, {
      username: [required('Username')],
      password: [required('Password')],
    });
    setErrors(result.errors);
    if (!result.isValid) return;

    setPending(true);
    try {
      // Never a signed-in session directly any more — see the module
      // comment on why every password login now stops here and waits for
      // the code step below.
      const step = await login(values.username.trim(), values.password);
      setMfaToken(step.mfa_token);
      setTotpEnabled(step.totp_enabled);
    } catch (err) {
      setFailure(err);
    } finally {
      setPending(false);
    }
  }

  async function onSubmitMfaCode(event) {
    event.preventDefault();
    setMfaError(null);
    if (!mfaCode.trim()) {
      setMfaError('Enter the code to continue.');
      return;
    }

    setMfaPending(true);
    try {
      const { user: signedIn, mustChangePassword } = await verifyMfaCode(mfaToken, mfaCode.trim());
      if (mustChangePassword) {
        setPendingReset(signedIn);
      } else {
        navigate(landingFor(signedIn), { replace: true });
      }
    } catch (err) {
      setMfaError(err.message);
    } finally {
      setMfaPending(false);
    }
  }

  async function onSubmitPasswordReset(event) {
    event.preventDefault();
    setResetError(null);

    if (newPassword.length < 12) {
      setResetError('Use at least 12 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError('The two passwords do not match.');
      return;
    }

    setResetPending(true);
    try {
      await authApi.setPassword(newPassword);
      navigate(landingFor(pendingReset), { replace: true });
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetPending(false);
    }
  }

  function fillFromAccount(username) {
    setValues({ username, password: DEMO_PASSWORD });
    setErrors({});
    setFailure(null);
  }

  /* Face and fingerprint both resolve to the exact {access_token, user}
     shape /auth/login does — adopted the same way Signup.jsx adopts a
     freshly-registered session, since neither of them went through the
     useAuth().login() password path this component also uses. */
  function onBiometricSuccess(result) {
    setToken(result.access_token);
    adopt(result.user);
    if (result.must_change_password) {
      setPendingReset(result.user);
    } else {
      navigate(landingFor(result.user), { replace: true });
    }
  }

  const passwordForm = (
    <>
      <form onSubmit={onSubmit} noValidate>
        {failure && (
          <p className="login-card__error" role="alert">
            {failure.message}
          </p>
        )}

        <label className="login-field" htmlFor="username">
          <span className="login-field__label">Username</span>
          <span className={`login-field__control${errors.username ? ' is-invalid' : ''}`}>
            <User size={17} strokeWidth={1.5} aria-hidden="true" />
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              placeholder="Enter your username"
              value={values.username}
              onChange={(event) => set('username', event.target.value)}
              aria-invalid={errors.username ? 'true' : undefined}
            />
          </span>
          {errors.username && (
            <span className="login-field__error" role="alert">
              {errors.username}
            </span>
          )}
        </label>

        <label className="login-field" htmlFor="password">
          <span className="login-field__label">Password</span>
          <span className={`login-field__control${errors.password ? ' is-invalid' : ''}`}>
            <Lock size={17} strokeWidth={1.5} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={values.password}
              onChange={(event) => set('password', event.target.value)}
              aria-invalid={errors.password ? 'true' : undefined}
            />
            <button
              type="button"
              className="login-field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
            </button>
          </span>
          {errors.password && (
            <span className="login-field__error" role="alert">
              {errors.password}
            </span>
          )}
        </label>

        {/* Credentials come from the district office under the Act, not a
            self-service reset — saying so plainly beats a "Forgot
            password?" link that leads nowhere real. */}
        <p className="login-card__reset">
          {accountKind === 'landowner'
            ? 'Your username and password were issued by your district office.'
            : 'Forgotten your password? Contact your district office.'}
        </p>

        <Button type="submit" variant="primary" block className="login-card__submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {SHOW_DEMO_ACCOUNTS && (
        <div className="login-card__accounts">
          <p className="login-card__accounts-heading">
            {accountKind === 'landowner' ? 'Landowner account' : 'Officer accounts'}
          </p>
          <ul className="login-card__accounts-list">
            {ACCOUNTS.filter((account) => account.tab === accountKind).map((account) => (
              <li key={account.username}>
                <button type="button" className="login-card__account" onClick={() => fillFromAccount(account.username)}>
                  <span className="login-card__account-name">{account.username}</span>
                  <span className="login-card__account-role">{roleLabel(account.role)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="login-card__accounts-note">
            All use the password <code>{DEMO_PASSWORD}</code>.
          </p>
        </div>
      )}
    </>
  );

  /* The code step. Shown in exactly the two places passwordForm is, once
     mfaToken is set — never its own separate mode, since it isn't a
     factor on the precedence order beside face/fingerprint/password, it's
     the second half of "password" itself. */
  const mfaCodeForm = (
    <form className="login-mfa" onSubmit={onSubmitMfaCode} noValidate>
      {mfaError && (
        <p className="login-card__error" role="alert">
          {mfaError}
        </p>
      )}

      <p className="login-mfa__lede">
        {totpEnabled
          ? 'Enter the 6-digit code from your authenticator app.'
          : "This account hasn't set up an authenticator app yet. Enter the temporary access code 123456 to continue — set up a real one from Security once you're signed in."}
      </p>

      <label className="login-field" htmlFor="mfa-code">
        <span className="login-field__label">Verification code</span>
        <span className={`login-field__control${mfaError ? ' is-invalid' : ''}`}>
          <KeyRound size={17} strokeWidth={1.5} aria-hidden="true" />
          <input
            id="mfa-code"
            name="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
          />
        </span>
      </label>

      <Button type="submit" variant="primary" block className="login-card__submit" disabled={mfaPending}>
        {mfaPending ? 'Verifying…' : 'Verify and sign in'}
      </Button>

      <div className="login-biometric-fallbacks">
        <button type="button" className="login-biometric-fallback" onClick={resetMfaStep}>
          Wrong account? Start over
        </button>
      </div>
    </form>
  );

  /* Shown once, only for an account BhoomiMitra provisioned itself (see
     Notices.jsx's ProvisionSection) — the session is already signed in at
     this point, so there is no password field for the old one, only the
     new one twice. */
  const passwordResetForm = (
    <form className="login-mfa" onSubmit={onSubmitPasswordReset} noValidate>
      <p className="login-mfa__lede">
        Your BhoomiMitra login was created with a temporary password. Set a new one to
        continue.
      </p>

      {resetError && (
        <p className="login-card__error" role="alert">
          {resetError}
        </p>
      )}

      <label className="login-field" htmlFor="new-password">
        <span className="login-field__label">New password</span>
        <span className="login-field__control">
          <Lock size={17} strokeWidth={1.5} aria-hidden="true" />
          <input
            id="new-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder="At least 12 characters"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </span>
      </label>

      <label className="login-field" htmlFor="confirm-new-password">
        <span className="login-field__label">Confirm new password</span>
        <span className="login-field__control">
          <Lock size={17} strokeWidth={1.5} aria-hidden="true" />
          <input
            id="confirm-new-password"
            name="confirm-new-password"
            type="password"
            autoComplete="new-password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
          />
        </span>
      </label>

      <Button type="submit" variant="primary" block className="login-card__submit" disabled={resetPending}>
        {resetPending ? 'Saving…' : 'Set password and continue'}
      </Button>
    </form>
  );

  return (
    <div className="public">
      <PublicHeader />

      <div className="login-page">
        <div className="login-card">
          <aside className="login-card__welcome">
            <h1 className="login-card__welcome-title">Welcome back</h1>
            {/* The page header above already carries the full wordmark;
                this is the same mark at card scale, so the brand still
                reads once you're this far into the flow. */}
            <div className="login-card__logo" aria-hidden="true">
              <img src="/brand/logo.png" alt="" className="login-card__logo-mark" />
              <span className="login-card__logo-word">BHOOMIMITRA</span>
            </div>
            <p className="login-card__welcome-sub">
              Sign in to continue managing land acquisition cases, wherever you left
              off.
            </p>

            <img
              src="/brand/logo.png"
              alt="Bhoomimitra"
              className="login-card__welcome-mark"
            />

            <ul className="login-card__trust">
              {TRUST.map(({ icon: Icon, heading, detail }) => (
                <li key={heading}>
                  <span className="login-card__trust-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="login-card__trust-heading">{heading}</span>
                    <span className="login-card__trust-detail">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          <main className="login-card__form" id="main">
            <h2 className="login-card__form-title">
              {pendingReset
                ? 'Set a new password'
                : accountKind === 'landowner'
                  ? 'Sign in with your password'
                  : 'Sign in to your account'}
            </h2>

            {pendingReset ? (
              passwordResetForm
            ) : (
              <>
                {/* Which account this is decides which methods are even
                    offered — a landowner has no camera or scanner enrolled
                    against their account and never will. */}
                <div className="login-role-tabs" role="tablist" aria-label="Account type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountKind === 'landowner'}
                    className={`login-role-tabs__tab${accountKind === 'landowner' ? ' is-active' : ''}`}
                    onClick={() => chooseAccountKind('landowner')}
                  >
                    Land Owner
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountKind === 'officer'}
                    className={`login-role-tabs__tab${accountKind === 'officer' ? ' is-active' : ''}`}
                    onClick={() => chooseAccountKind('officer')}
                  >
                    Officer
                  </button>
                </div>

                {accountKind === 'landowner' && (mfaToken ? mfaCodeForm : passwordForm)}

                {accountKind === 'officer' && (mode === 'face' || mode === 'fingerprint') && (
                  <div className="login-biometric-username">
                    <label className="login-field" htmlFor="biometric-username">
                      <span className="login-field__label">Username</span>
                      <span className="login-field__control">
                        <User size={17} strokeWidth={1.5} aria-hidden="true" />
                        <input
                          id="biometric-username"
                          name="username"
                          autoComplete="username"
                          autoFocus
                          placeholder="Enter your username"
                          value={values.username}
                          onChange={(event) => set('username', event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              if (mode === 'face') faceCardRef.current?.submitNow();
                            }
                          }}
                        />
                      </span>
                    </label>
                  </div>
                )}

                {accountKind === 'officer' && mode === 'face' && (
                  <>
                    <FaceLoginCard ref={faceCardRef} username={values.username} onSuccess={onBiometricSuccess} />
                    <div className="login-biometric-fallbacks">
                      <button type="button" className="login-biometric-fallback" onClick={() => setMode('fingerprint')}>
                        Issues with face? Unlock through fingerprint
                      </button>
                    </div>
                  </>
                )}

                {accountKind === 'officer' && mode === 'fingerprint' && (
                  <>
                    <FingerprintFallback username={values.username} onSuccess={onBiometricSuccess} />
                    <div className="login-biometric-fallbacks">
                      <button type="button" className="login-biometric-fallback" onClick={() => setMode('password')}>
                        Issues with fingerprint? Use password instead
                      </button>
                    </div>
                  </>
                )}

                {accountKind === 'officer' && mode === 'password' && (mfaToken ? mfaCodeForm : passwordForm)}

                {(accountKind === 'landowner' || mode === 'password') && !mfaToken && (
                  <p className="login-card__signup">
                    Been issued an invitation code? <Link to="/signup">Create an account</Link>
                  </p>
                )}
              </>
            )}
          </main>
        </div>

        <p className="login-privacy">
          Your data is safe with us. We value your privacy.
        </p>
      </div>
    </div>
  );
}
