import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldCheck, User, UserCheck2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isLandowner } from '../auth/permissions';
import { roleLabel } from '../lib/labels';
import { required, validate } from '../lib/validate';
import { ABOUT_PDF_URL } from '../lib/constants';
import { setToken } from '../api/client';
import Button from '../components/ui/Button';
import PublicHeader from '../components/public/PublicHeader';
import FaceLoginCard from '../components/auth/FaceLoginCard';
import FingerprintFallback from '../components/auth/FingerprintFallback';
import '../components/public/public.css';
import '../components/auth/auth.css';
import './login.css';

/* Built to the Figma "login-page" frame's split card, with two deliberate
   departures from it:

   - The frame asks for a User-ID field and an Email-ID field as well as a
     password. This system issues one credential per officer — a username —
     and the API takes exactly that plus a password, so a second identity
     field would be asking for information nothing downstream uses.
   - The frame's Land Owner / Officer toggle picks between two roles. This
     system has nine, so the toggle survives as a filter over the demo
     account list rather than a role picker — "Officer" narrows it to the
     five staff accounts, "Landowner" to the one — which keeps it a real
     control instead of a decorative two-state stand-in for nine roles. */

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
  const { login, adopt, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accountTab, setAccountTab] = useState('landowner');
  // 'face' first, always — this screen's whole reason for existing.
  // 'fingerprint' and 'password' are both one tap away below the card,
  // and neither is "less" of a sign-in method than the other: fingerprint
  // just depends on hardware most machines don't have.
  const [mode, setMode] = useState('face');

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
    // rather than showing a form they do not need.
    if (user) navigate(landingFor(user), { replace: true });
  }, [user, navigate, landingFor]);

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
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
      const signedIn = await login(values.username.trim(), values.password);
      navigate(landingFor(signedIn), { replace: true });
    } catch (err) {
      setFailure(err);
    } finally {
      setPending(false);
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
    navigate(landingFor(result.user), { replace: true });
  }

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
              {mode === 'password' ? 'Sign in with your password' : 'Sign in to your account'}
            </h2>

            {mode !== 'password' && (
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
                    />
                  </span>
                </label>
              </div>
            )}

            {mode === 'face' && (
              <>
                <FaceLoginCard username={values.username} onSuccess={onBiometricSuccess} />
                <div className="login-biometric-fallbacks">
                  <button
                    type="button"
                    className="login-biometric-fallback"
                    onClick={() => setMode('fingerprint')}
                  >
                    Issues with face? Unlock through fingerprint
                  </button>
                  <button
                    type="button"
                    className="login-biometric-fallback login-biometric-fallback--quiet"
                    onClick={() => setMode('password')}
                  >
                    Use password instead
                  </button>
                </div>
              </>
            )}

            {mode === 'fingerprint' && (
              <>
                <FingerprintFallback username={values.username} onSuccess={onBiometricSuccess} />
                <div className="login-biometric-fallbacks">
                  <button
                    type="button"
                    className="login-biometric-fallback"
                    onClick={() => setMode('face')}
                  >
                    Use face recognition instead
                  </button>
                  <button
                    type="button"
                    className="login-biometric-fallback login-biometric-fallback--quiet"
                    onClick={() => setMode('password')}
                  >
                    Use password instead
                  </button>
                </div>
              </>
            )}

            {mode === 'password' && (
              <>
                {/* Filters the demo accounts below rather than picking a role
                    on the form itself — this system issues one credential
                    per officer, so which account is "yours" still comes
                    from choosing an account, just narrowed to the right
                    half of the list first.

                    Hidden with the list it filters: with no accounts
                    rendered these two buttons would control nothing, which
                    is the exact kind of dead chrome worth not shipping. */}
                {SHOW_DEMO_ACCOUNTS && (
                  <div className="login-role-tabs" role="tablist" aria-label="Account type">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accountTab === 'landowner'}
                      className={`login-role-tabs__tab${accountTab === 'landowner' ? ' is-active' : ''}`}
                      onClick={() => setAccountTab('landowner')}
                    >
                      Land Owner
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accountTab === 'officer'}
                      className={`login-role-tabs__tab${accountTab === 'officer' ? ' is-active' : ''}`}
                      onClick={() => setAccountTab('officer')}
                    >
                      Officer
                    </button>
                  </div>
                )}

                <form onSubmit={onSubmit} noValidate>
                  {failure && (
                    <p className="login-card__error" role="alert">
                      {failure.message}
                    </p>
                  )}

                  <label className="login-field" htmlFor="username">
                    <span className="login-field__label">Username</span>
                    <span
                      className={`login-field__control${errors.username ? ' is-invalid' : ''}`}
                    >
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
                    <span
                      className={`login-field__control${errors.password ? ' is-invalid' : ''}`}
                    >
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
                        {showPassword ? (
                          <EyeOff size={16} strokeWidth={1.5} />
                        ) : (
                          <Eye size={16} strokeWidth={1.5} />
                        )}
                      </button>
                    </span>
                    {errors.password && (
                      <span className="login-field__error" role="alert">
                        {errors.password}
                      </span>
                    )}
                  </label>

                  {/* Credentials come from the district office under the
                      Act, not a self-service reset — saying so plainly
                      beats a "Forgot password?" link that leads nowhere
                      real. */}
                  <p className="login-card__reset">
                    Forgotten your password? Contact your district office.
                  </p>

                  <Button type="submit" variant="primary" block className="login-card__submit" disabled={pending}>
                    {pending ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>

                <p className="login-card__signup">
                  Been issued an invitation code? <Link to="/signup">Create an account</Link>
                </p>

                {SHOW_DEMO_ACCOUNTS && (
                  <div className="login-card__accounts">
                    <p className="login-card__accounts-heading">
                      {accountTab === 'landowner' ? 'Landowner account' : 'Officer accounts'}
                    </p>
                    <ul className="login-card__accounts-list">
                      {ACCOUNTS.filter((account) => account.tab === accountTab).map((account) => (
                        <li key={account.username}>
                          <button
                            type="button"
                            className="login-card__account"
                            onClick={() => fillFromAccount(account.username)}
                          >
                            <span className="login-card__account-name">{account.username}</span>
                            <span className="login-card__account-role">
                              {roleLabel(account.role)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="login-card__accounts-note">
                      All use the password <code>{DEMO_PASSWORD}</code>.
                    </p>
                  </div>
                )}

                <div className="login-biometric-fallbacks">
                  <button
                    type="button"
                    className="login-biometric-fallback login-biometric-fallback--quiet"
                    onClick={() => setMode('face')}
                  >
                    Sign in with face recognition instead
                  </button>
                </div>
              </>
            )}
          </main>
        </div>

        <p className="login-privacy">
          Your data is safe with us. We value your privacy.
        </p>

        <div className="about-blurb">
          <h2 className="about-blurb__title">About Bhoomimitra</h2>
          <p className="about-blurb__text">
            Bhoomimitra is a case-management platform built for India&rsquo;s land acquisition
            process under the RFCTLARR Act, 2013. It gives officers and affected families a
            single, transparent record of a case from preliminary notification through to
            possession.{' '}
            <a href={ABOUT_PDF_URL} target="_blank" rel="noopener noreferrer">
              Read more
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
