import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { setToken } from '../api/client';
import { isLandowner } from '../auth/permissions';
import { roleLabel } from '../lib/labels';
import * as fmt from '../lib/format';
import { maxLength, minLength, required, validate } from '../lib/validate';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import PublicHeader from '../components/public/PublicHeader';
import FaceCaptureCard from '../components/auth/FaceCaptureCard';
import '../components/public/public.css';
import '../components/auth/auth.css';
import './login.css';

/* Registration, gated on an invitation — for officers and administrators
   only now. A landowner never lands here: BhoomiMitra provisions their
   account itself once their land is verified against a search on the
   public Notices page (see Notices.jsx's ProvisionSection and
   POST /notices/provision), rather than asking them to type in a code
   somebody handed them. Removing that path from this screen isn't just a
   copy change — the old "I'm a landowner" card still led to the same
   invite-code form underneath, which meant a landowner account could only
   ever come from someone else's invitation, when the actual source of
   truth for who they are is the land record itself.

   The code is checked on its own before the rest of the form, so the
   person can see which role and district it actually grants before
   choosing a password — and so a wrong code fails immediately instead of
   after they have filled a form. */

const OFFICER_INTRO =
  'Officer accounts are issued by your district or state office. Register with the invitation code you were given when your access was set up.';
const OFFICER_HINT = 'Issued by an administrator. It decides which role your account gets.';

export default function Signup() {
  const navigate = useNavigate();
  const { adopt } = useAuth();

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
    if (!faceFrame) {
      result.errors.face = 'Face capture is required to create this account.';
      result.isValid = false;
    }

    setErrors(result.errors);
    if (!result.isValid) return;

    setPending(true);
    try {
      // face_image_base64 travels in the same request as everything else —
      // the backend validates and enrolls it in the same transaction as
      // the account, so a bad photo fails registration cleanly instead of
      // leaving a password-only account behind with a missing mandatory
      // credential.
      const created = await authApi.register({
        invite_code: code.trim(),
        username: values.username.trim(),
        full_name: values.full_name.trim(),
        password: values.password,
        face_image_base64: faceFrame,
      });

      // Registration signs you in, so there is no second form to fill.
      setToken(created.access_token);
      adopt(created.user);
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
              they are not self-serve. Registration here is for officers and
              administrators, issued by invitation from your district or state office.
            </p>
            <p className="login__sub">
              Looking for your own land&rsquo;s status instead? Search it on the{' '}
              <Link to="/notices">Notices</Link> page — BhoomiMitra issues a landowner
              login directly from that record, with nothing to type in here.
            </p>

            {!invite ? (
              <>
                <p className="login__sub">{OFFICER_INTRO}</p>

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
                    hint={OFFICER_HINT}
                  />

                  <Button type="submit" variant="primary" block disabled={checking}>
                    {checking ? 'Checking…' : 'Continue'}
                  </Button>
                </form>
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

                  <div className="signup__face">
                    <p className="signup__grant-label">FACE SIGN-IN — REQUIRED</p>
                    <p className="signup__grant-meta">
                      Every officer account signs in by face. Centre your face in the frame,
                      then capture, before creating the account.
                    </p>
                    <FaceCaptureCard onCapture={setFaceFrame} />
                    {errors.face && (
                      <p className="login__error" role="alert">
                        {errors.face}
                      </p>
                    )}
                  </div>

                  <Button type="submit" variant="primary" block disabled={pending}>
                    {pending ? 'Creating the account…' : 'Create account'}
                  </Button>
                </form>
              </>
            )}

            <p className="signup__alt">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
