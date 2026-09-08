import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { isLandowner } from '../../auth/permissions';
import { useI18n } from '../../i18n/I18nContext';
import { ABOUT_PDF_URL } from '../../lib/constants';
import Button from '../ui/Button';

/* The mauve chrome bar shared by every public page — landing, notices,
   contact, support, login, signup. Same nav everywhere: Home, About Us,
   Notices, Contact, Support, and — since this is the one bar every public
   page shares — the language switch (see I18nProvider's own note on why
   translation stops at this boundary and does not follow a visitor into
   the signed-in workspace). No Login/Signup buttons here — a visitor who
   wants to sign in reaches it from the footer or a direct link, not from
   this bar. Signed-in visitors get a way back into the app instead.

   About Us has no page of its own — it opens the printed about document in
   a new tab, same as the "Read More" link on the login and signup screens. */
export default function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const { t, locale, setLocale, locales } = useI18n();

  const links = [
    { to: '/', label: t('publicHeader.home') },
    { to: '/notices', label: t('publicHeader.notices') },
    { to: '/contact', label: t('publicHeader.contact') },
    { to: '/support', label: t('publicHeader.support') },
  ];

  return (
    <header className="public-header">
      <Link to="/" className="public-header__brand">
        <img src="/brand/logo.png" alt="" className="public-header__mark" aria-hidden="true" />
        <span className="public-header__word">BHOOMIMITRA</span>
      </Link>

      <nav className="public-header__nav" aria-label="Primary">
        <Link to="/" className={location.pathname === '/' ? 'is-active' : undefined}>
          {t('publicHeader.home')}
        </Link>
        <a href={ABOUT_PDF_URL} target="_blank" rel="noopener noreferrer">
          {t('publicHeader.aboutUs')}
        </a>
        {links.slice(1).map(({ to, label }) => (
          <Link key={to} to={to} className={location.pathname === to ? 'is-active' : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="public-header__actions">
        <label className="public-header__lang">
          <span className="sr-only">{t('publicHeader.language')}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value)}>
            {locales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {user && (
          <Button to={isLandowner(user) ? '/cases' : '/dashboard'} variant="secondary" size="public">
            {t('publicHeader.myWorkspace')}
          </Button>
        )}
      </div>
    </header>
  );
}
