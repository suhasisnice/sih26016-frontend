import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, User, UserCheck2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isLandowner } from '../auth/permissions';
import * as authApi from '../api/auth';
import { useI18n } from '../i18n/I18nContext';
import { roleLabel } from '../lib/labels';
import { required, validate } from '../lib/validate';
import { setToken } from '../api/client';
import Button from '../components/ui/Button';
import PublicHeader from '../components/public/PublicHeader';
import FaceLoginCard from '../components/auth/FaceLoginCard';
import LoginSuccessOverlay from '../components/auth/LoginSuccessOverlay';
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
     precedence order, not a menu: face recognition first, and — if that
     has issues — a quiet "issues with face?" link down to username and
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

export default function Login() {
  const { t } = useI18n();
  const TRUST = [
    { icon: ShieldCheck, heading: t('login.trustSecureHeading'), detail: t('login.trustSecureDetail') },
    { icon: UserCheck2, heading: t('login.trustTrustedHeading'), detail: t('login.trustTrustedDetail') },
    { icon: Lock, heading: t('login.trustReliableHeading'), detail: t('login.trustReliableDetail') },
  ];
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
     'password', moved down by the "issues with X?" link under whichever
     is showing. Starts at the top every time; there's no memory of "this
     desk has no camera" yet. A landowner never has a mode at all — there
     is only ever the one method for that account kind. */
  const [mode, setMode] = useState('face');
  // Enter in the username field below calls faceCardRef.current.submitNow()
  // — the fast path past FaceLoginCard's own debounce, for anyone who
  // typed a full username they're confident in.
  const faceCardRef = useRef(null);

  /* Set the instant any sign-in path succeeds — its presence swaps the
     whole card for LoginSuccessOverlay and holds the actual navigate()
     until that overlay's own beat finishes, rather than jumping to the
     next page the moment the credential checks out. */
  const [signingInAs, setSigningInAs] = useState(null);

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
    // rather than showing a form they do not need. Held off on two separate
    // grounds: while a forced password reset is pending (the session is
    // already real, but the person still has to replace a generated
    // password first), and while signingInAs is set (a sign-in that just
    // happened on this page adopts the user into context immediately, but
    // navigation itself waits for the success overlay's own beat to finish
    // — see finishSignIn below).
    if (user && !pendingReset && !signingInAs) navigate(landingFor(user), { replace: true });
  }, [user, pendingReset, signingInAs, navigate, landingFor]);

  function finishSignIn() {
    if (signingInAs) navigate(landingFor(signingInAs), { replace: true });
  }

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
      setMfaError(t('login.enterCodeToContinue'));
      return;
    }

    setMfaPending(true);
    try {
      const { user: signedIn, mustChangePassword } = await verifyMfaCode(mfaToken, mfaCode.trim());
      if (mustChangePassword) {
        setPendingReset(signedIn);
      } else {
        setSigningInAs(signedIn);
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
      setResetError(t('login.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError(t('login.passwordsDontMatch'));
      return;
    }

    setResetPending(true);
    try {
      await authApi.setPassword(newPassword);
      // Same landing beat every other sign-in gets, not a silent jump — the
      // person just finished the one extra step a provisioned account
      // requires, so nothing else about arriving should look different.
      setSigningInAs(pendingReset);
      setPendingReset(null);
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

  /* Face login resolves to the exact {access_token, user} shape
     /auth/login does — adopted the same way Signup.jsx adopts a
     freshly-registered session, since it didn't go through the
     useAuth().login() password path this component also uses. */
  function onBiometricSuccess(result) {
    setToken(result.access_token);
    adopt(result.user);
    if (result.must_change_password) {
      setPendingReset(result.user);
    } else {
      setSigningInAs(result.user);
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
          <span className="login-field__label">{t('login.username')}</span>
          <span className={`login-field__control${errors.username ? ' is-invalid' : ''}`}>
            <User size={17} strokeWidth={1.5} aria-hidden="true" />
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              placeholder={t('login.usernamePlaceholder')}
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
          <span className="login-field__label">{t('login.password')}</span>
          <span className={`login-field__control${errors.password ? ' is-invalid' : ''}`}>
            <Lock size={17} strokeWidth={1.5} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
              value={values.password}
              onChange={(event) => set('password', event.target.value)}
              aria-invalid={errors.password ? 'true' : undefined}
            />
            <button
              type="button"
              className="login-field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
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
          {accountKind === 'landowner' ? t('login.resetNoteLandowner') : t('login.resetNoteOfficer')}
        </p>

        <Button type="submit" variant="primary" block className="login-card__submit" disabled={pending}>
          {pending ? t('login.signingIn') : t('login.signIn')}
        </Button>
      </form>

      {SHOW_DEMO_ACCOUNTS && (
        <div className="login-card__accounts">
          <p className="login-card__accounts-heading">
            {accountKind === 'landowner' ? t('login.demoLandownerHeading') : t('login.demoOfficerHeading')}
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
          <p className="login-card__accounts-note">{t('login.demoNote', DEMO_PASSWORD)}</p>
        </div>
      )}
    </>
  );

  /* The code step. Shown in exactly the two places passwordForm is, once
     mfaToken is set — never its own separate mode, since it isn't a
     factor on the precedence order beside face/password, it's the second
     half of "password" itself. */
  const mfaCodeForm = (
    <form className="login-mfa" onSubmit={onSubmitMfaCode} noValidate>
      {mfaError && (
        <p className="login-card__error" role="alert">
          {mfaError}
        </p>
      )}

      <p className="login-mfa__lede">
        {totpEnabled ? t('login.totpLede') : t('login.totpFallbackLede')}
      </p>

      <label className="login-field" htmlFor="mfa-code">
        <span className="login-field__label">{t('login.verificationCode')}</span>
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
        {mfaPending ? t('login.verifying') : t('login.verifyAndSignIn')}
      </Button>

      <div className="login-biometric-fallbacks">
        <button type="button" className="login-biometric-fallback" onClick={resetMfaStep}>
          {t('login.wrongAccount')}
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
      <p className="login-mfa__lede">{t('login.resetLede')}</p>

      {resetError && (
        <p className="login-card__error" role="alert">
          {resetError}
        </p>
      )}

      <label className="login-field" htmlFor="new-password">
        <span className="login-field__label">{t('login.newPassword')}</span>
        <span className="login-field__control">
          <Lock size={17} strokeWidth={1.5} aria-hidden="true" />
          <input
            id="new-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder={t('login.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </span>
      </label>

      <label className="login-field" htmlFor="confirm-new-password">
        <span className="login-field__label">{t('login.confirmNewPassword')}</span>
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
        {resetPending ? t('login.saving') : t('login.setPasswordAndContinue')}
      </Button>
    </form>
  );

  if (signingInAs) {
    return (
      <LoginSuccessOverlay
        label={t('login.signedInAs', signingInAs.full_name)}
        onDone={finishSignIn}
      />
    );
  }

  return (
    <div className="public">
      <PublicHeader />

      <div className="login-page">
        <div className="login-card">
          <aside className="login-card__welcome">
            <h1 className="login-card__welcome-title">{t('login.welcomeBack')}</h1>
            {/* The page header above already carries the full wordmark;
                this is the same mark at card scale, so the brand still
                reads once you're this far into the flow. */}
            <div className="login-card__logo" aria-hidden="true">
              <img src="/brand/logo.png" alt="" className="login-card__logo-mark" />
              <span className="login-card__logo-word">BHOOMIMITRA</span>
            </div>
            <p className="login-card__welcome-sub">{t('login.welcomeSub')}</p>

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
                ? t('login.titleResetPassword')
                : accountKind === 'landowner'
                  ? t('login.titleLandownerSignIn')
                  : t('login.titleOfficerSignIn')}
            </h2>

            {pendingReset ? (
              passwordResetForm
            ) : (
              <>
                {/* Which account this is decides which methods are even
                    offered — a landowner has no camera or scanner enrolled
                    against their account and never will. */}
                <div className="login-role-tabs" role="tablist" aria-label={t('login.accountType')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountKind === 'landowner'}
                    className={`login-role-tabs__tab${accountKind === 'landowner' ? ' is-active' : ''}`}
                    onClick={() => chooseAccountKind('landowner')}
                  >
                    {t('login.landOwnerTab')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accountKind === 'officer'}
                    className={`login-role-tabs__tab${accountKind === 'officer' ? ' is-active' : ''}`}
                    onClick={() => chooseAccountKind('officer')}
                  >
                    {t('login.officerTab')}
                  </button>
                </div>

                {accountKind === 'landowner' && (mfaToken ? mfaCodeForm : passwordForm)}

                {accountKind === 'officer' && mode === 'face' && (
                  <div className="login-biometric-username">
                    <label className="login-field" htmlFor="biometric-username">
                      <span className="login-field__label">{t('login.username')}</span>
                      <span className="login-field__control">
                        <User size={17} strokeWidth={1.5} aria-hidden="true" />
                        <input
                          id="biometric-username"
                          name="username"
                          autoComplete="username"
                          autoFocus
                          placeholder={t('login.usernamePlaceholder')}
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
                      <button type="button" className="login-biometric-fallback" onClick={() => setMode('password')}>
                        {t('login.issuesWithFace')}
                      </button>
                    </div>
                  </>
                )}

                {accountKind === 'officer' && mode === 'password' && (mfaToken ? mfaCodeForm : passwordForm)}

                {(accountKind === 'landowner' || mode === 'password') && !mfaToken && (
                  <p className="login-card__signup">
                    {t('login.hasInviteCode')} <Link to="/signup">{t('login.createAccount')}</Link>
                  </p>
                )}
              </>
            )}
          </main>
        </div>

        <p className="login-privacy">{t('login.privacyNote')}</p>
      </div>
    </div>
  );
}
