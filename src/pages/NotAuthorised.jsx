import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isLandowner } from '../auth/permissions';
import { roleLabel } from '../lib/labels';
import PublicHeader from '../components/public/PublicHeader';
import Button from '../components/ui/Button';
import '../components/public/public.css';

/* Says which role is signed in rather than only refusing. A person who has
   landed here has usually followed a link meant for a different office, and
   knowing that is the difference between a dead end and an explanation. */
export default function NotAuthorised() {
  const { user } = useAuth();
  const home = isLandowner(user) ? '/cases' : '/dashboard';

  return (
    <div className="public">
      <PublicHeader />
      <main className="public-page" id="main">
        <h1 className="public-page__title">That page is not open to your role</h1>
        <div className="public-page__rule" aria-hidden="true" />
        <p className="public-page__lede">
          {user ? (
            <>
              You are signed in as <strong>{user.full_name}</strong>, {roleLabel(user.role)}.
              Access here is set by the office a role belongs to, and this page belongs
              to another one.
            </>
          ) : (
            <>You are not signed in.</>
          )}
        </p>
        <div style={{ marginTop: 'var(--s5)', display: 'flex', gap: 'var(--s3)' }}>
          {user ? (
            <Button to={home} variant="primary">Back to your work</Button>
          ) : (
            <Button to="/login" variant="primary">Sign in</Button>
          )}
          <Button to="/" variant="secondary">Home</Button>
        </div>
      </main>
    </div>
  );
}
