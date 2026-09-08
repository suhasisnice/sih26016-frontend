import { Link } from 'react-router-dom';
import { Facebook, Linkedin, Twitter } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

/* The mauve footer closing every public page: tagline, three link columns,
   thin social icons. Nothing here is a real destination — a hackathon
   prototype's footer is the one place a placeholder is honest, since the
   product has no press page or careers page to link to. */
export default function PublicFooter() {
  const { t } = useI18n();
  return (
    <footer className="public-footer">
      <div className="public-footer__top">
        <div className="public-footer__brand">
          <div className="public-footer__brand-row">
            <img src="/brand/logo.png" alt="" className="public-footer__mark" aria-hidden="true" />
            <span className="public-footer__word">BHOOMIMITRA</span>
          </div>
          <p className="public-footer__tagline">{t('publicFooter.tagline')}</p>
          <div className="public-footer__social">
            <a href="#" aria-label="Twitter"><Twitter size={16} strokeWidth={1.75} /></a>
            <a href="#" aria-label="LinkedIn"><Linkedin size={16} strokeWidth={1.75} /></a>
            <a href="#" aria-label="Facebook"><Facebook size={16} strokeWidth={1.75} /></a>
          </div>
        </div>

        <div className="public-footer__col">
          <p className="public-footer__heading">{t('publicFooter.platform')}</p>
          <Link to="/">{t('publicFooter.home')}</Link>
          <Link to="/notices">{t('publicFooter.notices')}</Link>
          <Link to="/login">{t('publicFooter.login')}</Link>
        </div>

        <div className="public-footer__col">
          <p className="public-footer__heading">{t('publicFooter.theAct')}</p>
          <Link to="/notices">{t('publicFooter.preliminaryNotifications')}</Link>
          <Link to="/notices">{t('publicFooter.declarations')}</Link>
        </div>

        <div className="public-footer__col">
          <p className="public-footer__heading">{t('publicFooter.ministry')}</p>
          <span>{t('publicFooter.deptLandResources')}</span>
          <span>{t('publicFooter.ministryRuralDev')}</span>
        </div>
      </div>

      <div className="public-footer__bottom">
        <span>{t('publicFooter.copyright', new Date().getFullYear())}</span>
      </div>
    </footer>
  );
}
