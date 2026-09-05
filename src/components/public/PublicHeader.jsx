import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isLandowner } from '../../auth/permissions';
import { ABOUT_PDF_URL } from '../../lib/constants';
import Button from '../ui/Button';

/* The mauve chrome bar shared by every public page — landing, notices,
   contact, support, login, signup. Same nav everywhere: Home, About Us,
   Notices, Contact, Support. No Login/Signup buttons here — a visitor who
   wants to sign in reaches it from the footer or a direct link, not from
   this bar. Signed-in visitors get a way back into the app instead.

   About Us has no page of its own — it opens the printed about document in
   a new tab, same as the "Read More" link on the login and signup screens. */
export default function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/', label: 'Home' },
    { to: '/notices', label: 'Notices' },
    { to: '/contact', label: 'Contact' },
    { to: '/support', label: 'Support' },
  ];

  return (
    <header className="public-header">
      <Link to="/" className="public-header__brand">
        <img src="/brand/logo.png" alt="" className="public-header__mark" aria-hidden="true" />
        <span className="public-header__word">BHOOMIMITRA</span>
      </Link>

      <nav className="public-header__nav" aria-label="Primary">
        <Link to="/" className={location.pathname === '/' ? 'is-active' : undefined}>
          Home
        </Link>
        <a href={ABOUT_PDF_URL} target="_blank" rel="noopener noreferrer">
          About Us
        </a>
        {links.slice(1).map(({ to, label }) => (
          <Link key={to} to={to} className={location.pathname === to ? 'is-active' : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {user && (
        <div className="public-header__actions">
          <Button to={isLandowner(user) ? '/cases' : '/dashboard'} variant="secondary" size="public">
            My workspace
          </Button>
        </div>
      )}
    </header>
  );
}
