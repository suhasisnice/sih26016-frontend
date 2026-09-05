import { useState } from 'react';
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
import '../components/public/public.css';
import './login.css';

/* Registration, gated on an invitation.

   Two steps on one screen. The code is checked first, on its own, so the
   person can see which role and district it grants before choosing a
   password — and so a wrong code fails immediately instead of after they
   have filled a form.

   The role is never a field. It comes from the invitation, which the backend
   reads server-side; nothing this page sends can change it. */
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
            <h1 className="login__title">Create an account</h1>
            <p className="login__sub">
              Accounts on this system carry authority over other people&rsquo;s land, so
              they are not self-serve. Register with the invitation code issued to
              you by your district office.
            </p>

            {!invite ? (
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
                  hint="Issued by an administrator. It decides which role your account gets."
                />

                <Button type="submit" variant="primary" block disabled={checking}>
                  {checking ? 'Checking…' : 'Continue'}
                </Button>
              </form>
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
                  {invite.expires_on && (
                    <p className="signup__grant-meta">
                      Valid until {fmt.dateLong(invite.expires_on)}.
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
