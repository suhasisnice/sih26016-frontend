import { useState } from 'react';
import { Landmark, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { setToken } from '../api/client';
import { isLandowner } from '../auth/permissions';
import { roleLabel } from '../lib/labels';
import * as fmt from '../lib/format';
import { maxLength, minLength, required, validate } from '../lib/validate';
import { ABOUT_PDF_URL } from '../lib/constants';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import PublicHeader from '../components/public/PublicHeader';
import FaceCaptureCard from '../components/auth/FaceCaptureCard';
import '../components/public/public.css';
import '../components/auth/auth.css';
import './login.css';

/* Registration, gated on an invitation.

   Three steps on one screen, not two. Which are you — landowner or
   officer — comes first, but it is orientation, not a real fork: the
   invitation code underneath is the same field either way and the backend
   checks it identically regardless of which card was clicked. The role is
   never a field the browser sends; it comes from the invitation itself,
   read server-side. Picking a card just puts the right words in front of
   the right person before they go looking for the code they were handed —
   "your district office" reads differently to someone who already works
   there than to someone whose land is the subject of a notice.

   The code is checked next, on its own, so the person can see which role
   and district it actually grants before choosing a password — and so a
   wrong code fails immediately instead of after they have filled a form. */

const APPLICANT_COPY = {
  landowner: {
    intro:
      'Landowner accounts are issued when land recorded in your name enters an acquisition case — the notice you received names the office that can give you a code.',
    hint: 'From the notice you received, or your district office.',
  },
  officer: {
    intro:
      'Officer accounts are issued by your district or state office. Register with the invitation code you were given when your access was set up.',
    hint: 'Issued by an administrator. It decides which role your account gets.',
  },
};

export default function Signup() {
  const navigate = useNavigate();
  const { adopt } = useAuth();

  const [applicantKind, setApplicantKind] = useState(null); // null | 'landowner' | 'officer'
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState(null);

  const [values, setValues] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [pending, setPending] = useState(false);

  // A landowner's account has no camera enrolled against it and never will
  // (Login.jsx draws the same line), so this only ever holds something for
  // an officer signup, and stays null — not "skipped" — for a landowner.
  const [faceFrame, setFaceFrame] = useState(null);

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onCheckCode(event) {
    event.preventDefault();
    setCodeError(null);

    if (!code.trim()) {
      setCodeError('Enter the invitation code you were issued');
      return;
    }

    setChecking(true);
    try {
      const result = await authApi.previewInvite(code.trim());
      if (result.valid) {
        setInvite(result);
      } else {
        setInvite(null);
        setCodeError(result.reason || 'That invitation code is not valid.');
      }
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFailure(null);

    const result = validate(values, {
      full_name: [required('Name'), minLength('Name', 2), maxLength('Name', 120)],
      username: [required('Username'), minLength('Username', 3)],
      password: [required('Password'), minLength('Password', 12)],
      confirm: [required('Confirmation')],
    });

    if (!result.errors.username && !/^[a-zA-Z0-9._-]+$/.test(values.username.trim())) {
      result.errors.username = 'Letters, numbers, dot, dash and underscore only';
      result.isValid = false;
    }
    if (!result.errors.confirm && values.confirm !== values.password) {
      result.errors.confirm = 'The two passwords do not match';
      result.isValid = false;
    }

    setErrors(result.errors);
    if (!result.isValid) return;

    setPending(true);
    try {
      const created = await authApi.register({
        invite_code: code.trim(),
        username: values.username.trim(),
        full_name: values.full_name.trim(),
        password: values.password,
      });

      // Registration signs you in, so there is no second form to fill.
      setToken(created.access_token);
      adopt(created.user);

      // POST /biometrics/face/enroll needs a bearer token, which does not
      // exist until the line above — this is why the frame was only ever
      // held in state rather than sent along with the registration itself.
      // A capture problem here does not undo the account that already
      // exists: it can always be added later from Security, so this is
      // best-effort and silent on failure rather than another error the
      // person has to read past on their way in.
      if (faceFrame) {
        try {
          await authApi.enrollFace(faceFrame);
        } catch {
          /* Account creation already succeeded; face sign-in stays offered
             from /security. */
        }
      }

      navigate(isLandowner(created.user) ? '/cases' : '/dashboard', { replace: true });
    } catch (err) {
      setFailure(err);
      // A consumed or withdrawn invitation invalidates the whole attempt, not
      // just this field — send them back to the first step rather than
      // letting them retry a form that cannot succeed.
      if (err.code === 'request_failed' || err.status === 400) {
        setInvite(null);
        setCodeError(err.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="public">
      <PublicHeader />

      <div className="login">
        <div
          className="login__photo"
          style={{ backgroundImage: 'url(/photos/login.jpg)' }}
          aria-hidden="true"
        >
          <div className="login__photo-wash" />
          <blockquote className="login__quote">
            <p>
              &ldquo;Every parcel represents a family, a livelihood, and a future.&rdquo;
            </p>
          </blockquote>
        </div>

        <main className="login__panel" id="main">
          <div className="login__panel-inner">
            <img src="/brand/logo.png" alt="" className="login__panel-mark" aria-hidden="true" />
            <h1 className="login__title">Create an account</h1>
            <p className="login__sub">
              Accounts on this system carry authority over other people&rsquo;s land, so
              they are not self-serve. Every one is issued by invitation.
            </p>

            {!applicantKind ? (
              <div className="signup__kind-choices">
                <button
                  type="button"
                  className="signup__kind-choice"
                  onClick={() => setApplicantKind('landowner')}
                >
                  <span className="signup__kind-choice-icon" aria-hidden="true">
                    <User size={20} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="signup__kind-choice-label">I&rsquo;m a landowner</span>
                    <span className="signup__kind-choice-detail">
                      Land recorded in my name is part of an acquisition case
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="signup__kind-choice"
                  onClick={() => setApplicantKind('officer')}
                >
                  <span className="signup__kind-choice-icon" aria-hidden="true">
                    <Landmark size={20} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="signup__kind-choice-label">I&rsquo;m an officer</span>
                    <span className="signup__kind-choice-detail">
                      I work for a district or state office running cases
                    </span>
                  </span>
                </button>
              </div>
            ) : !invite ? (
              <>
                <p className="login__sub">{APPLICANT_COPY[applicantKind].intro}</p>

                <form className="login__form" onSubmit={onCheckCode} noValidate>
                  {codeError && (
                    <p className="login__error" role="alert">
                      {codeError}
                    </p>
                  )}

                  <Input
                    label="Invitation code"
                    name="invite_code"
                    autoFocus
                    autoComplete="off"
                    spellCheck="false"
                    value={code}
                    placeholder="BHM-XXXXXXXXXXXX-…"
                    onChange={(event) => setCode(event.target.value)}
                    hint={APPLICANT_COPY[applicantKind].hint}
                  />

                  <Button type="submit" variant="primary" block disabled={checking}>
                    {checking ? 'Checking…' : 'Continue'}
                  </Button>
                </form>

                <button
                  type="button"
                  className="signup__grant-change"
                  onClick={() => {
                    setApplicantKind(null);
                    setCode('');
                    setCodeError(null);
                  }}
                >
                  Not {applicantKind === 'landowner' ? 'a landowner' : 'an officer'}?
                </button>
              </>
            ) : (
              <>
                <div className="signup__grant">
                  <p className="signup__grant-label">THIS INVITATION CREATES</p>
                  <p className="signup__grant-role">{roleLabel(invite.role)}</p>
                  <p className="signup__grant-meta">
                    {invite.district_name
                      ? `Scoped to ${invite.district_name}. You will see that district and no other.`
                      : 'Not restricted to a single district.'}
                  </p>
                  {invite.expires_at && (
                    <p className="signup__grant-meta">
                      Valid until {fmt.dateTime(invite.expires_at)}.
                    </p>
                  )}
                  <button
                    type="button"
                    className="signup__grant-change"
                    onClick={() => {
                      setInvite(null);
                      setFailure(null);
                    }}
                  >
                    Use a different code
                  </button>
                </div>

                <form className="login__form" onSubmit={onSubmit} noValidate>
                  {failure && (
                    <p className="login__error" role="alert">
                      {failure.message}
                    </p>
                  )}

                  <Input
                    label="Full name"
                    name="full_name"
                    autoFocus
                    autoComplete="name"
                    value={values.full_name}
                    error={errors.full_name}
                    placeholder="Kavitha Ramachandran"
                    onChange={(event) => set('full_name', event.target.value)}
                  />

                  <Input
                    label="Username"
                    name="username"
                    autoComplete="username"
                    spellCheck="false"
                    value={values.username}
                    error={errors.username}
                    placeholder="k.ramachandran"
                    onChange={(event) => set('username', event.target.value)}
                    hint="How you will sign in. It cannot be changed later."
                  />

                  <Input
                    label="Password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={values.password}
                    error={errors.password}
                    onChange={(event) => set('password', event.target.value)}
                    hint="At least 12 characters. A short phrase you can remember beats a short jumble you cannot."
                  />

                  <Input
                    label="Confirm password"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={values.confirm}
                    error={errors.confirm}
                    onChange={(event) => set('confirm', event.target.value)}
                  />

                  {/* Landowner accounts never get a camera or scanner enrolled
                      — Login.jsx draws the identical line for the same
                      reason — so this only appears for the officer path. */}
                  {applicantKind === 'officer' && (
                    <div className="signup__face">
                      <p className="signup__grant-label">FACE SIGN-IN (OPTIONAL)</p>
                      <p className="signup__grant-meta">
                        Capture it now to sign in by looking at the camera next time, or skip
                        this and add it later from Security.
                      </p>
                      <FaceCaptureCard onCapture={setFaceFrame} />
                    </div>
                  )}

                  <Button type="submit" variant="primary" block disabled={pending}>
                    {pending ? 'Creating the account…' : 'Create account'}
                  </Button>
                </form>
              </>
            )}

            <p className="signup__alt">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>

            <div className="about-blurb">
              <h2 className="about-blurb__title">About Bhoomimitra</h2>
              <p className="about-blurb__text">
                Bhoomimitra is a case-management platform built for India&rsquo;s land
                acquisition process under the RFCTLARR Act, 2013. It gives officers and
                affected families a single, transparent record of a case from preliminary
                notification through to possession.{' '}
                <a href={ABOUT_PDF_URL} target="_blank" rel="noopener noreferrer">
                  Read more
                </a>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
