import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isLandowner } from '../../auth/permissions';
import Button from '../ui/Button';

/* The mauve chrome bar shared by every public page — landing, notices,
   login, signup. Signed-in visitors get a way back into the app instead of
   a login button they no longer need. */
export default function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <header className="public-header">
      <Link to="/" className="public-header__brand">
        <span className="public-header__mark" aria-hidden="true">B</span>
        <span className="public-header__word">BHOOMIMITRA</span>
      </Link>

      <nav className="public-header__nav" aria-label="Primary">
        <Link
          to="/"
          className={location.pathname === '/' ? 'is-active' : undefined}
        >
          Home
        </Link>
        <Link
          to="/notices"
          className={location.pathname === '/notices' ? 'is-active' : undefined}
        >
          Notices
        </Link>
      </nav>

      <div className="public-header__actions">
        {user ? (
          <Button to={isLandowner(user) ? '/cases' : '/dashboard'} variant="secondary" size="public">
            My workspace
          </Button>
        ) : (
          <>
            <Button to="/login" variant="secondary" size="public">
              Login
            </Button>
            <Button to="/signup" variant="primary" size="public">
              Signup
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
