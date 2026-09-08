import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import PhotoStrip from '../components/public/PhotoStrip';
import LandingHighlights from '../components/public/LandingHighlights';
import Button from '../components/ui/Button';
import { useI18n } from '../i18n/I18nContext';
import { ABOUT_PDF_URL } from '../lib/constants';
import '../components/public/public.css';

/* Built to the Figma "Home" frame: header, photo hero, cream statement band,
   photo strip, footer. The strip uses our own local photography rather than
   the frame's placeholder stock images — see PhotoStrip.

   Signup goes to the invitation-gated registration form. Accounts here are
   issued by the district office rather than self-serve, so that screen asks
   for the code first and shows which role it grants. */
export default function Landing() {
  const { t } = useI18n();
  return (
    <div className="public">
      <PublicHeader />

      <section className="hero">
        <div
          className="hero__photo"
          style={{ backgroundImage: 'url(/photos/hero.jpg)' }}
          aria-hidden="true"
        />
        <div className="hero__wash" aria-hidden="true" />

        <div className="hero__inner">
          <h1 className="hero__title">
            {t('landing.heroTitle1')}
            <br />
            {t('landing.heroTitle2')}
          </h1>
          <p className="hero__body">{t('landing.heroBody')}</p>
          <div className="hero__actions">
            <Button to="/login" variant="primary" size="public">
              {t('landing.login')}
            </Button>
            <Button to="/signup" variant="secondary" size="public">
              {t('landing.signup')}
            </Button>
          </div>
        </div>
      </section>

      <LandingHighlights />

      <section className="statement">
        <h2 className="statement__title">
          {t('landing.statementTitle1')}
          <br />
          {t('landing.statementTitle2')}
        </h2>
        <p className="statement__body">{t('landing.statementBody')}</p>
        <div className="statement__actions">
          <Button to="/notices" variant="primary" size="public-lg">
            {t('landing.noticesButton')}
          </Button>
          <Button to="/case-studies" variant="secondary" size="public-lg">
            {t('landing.caseStudies')}
          </Button>
        </div>

        <div className="statement__about">
          <h3 className="statement__about-title">{t('landing.aboutTitle')}</h3>
          <p className="statement__about-text">
            {t('landing.aboutBody')}{' '}
            <a href={ABOUT_PDF_URL} target="_blank" rel="noopener noreferrer">
              {t('landing.readMore')}
            </a>
          </p>
        </div>
      </section>

      <PhotoStrip />

      <PublicFooter />
    </div>
  );
}
