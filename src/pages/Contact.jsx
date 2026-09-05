import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import '../components/public/public.css';

export default function Contact() {
  return (
    <div className="public">
      <PublicHeader />
      <main className="public-page" id="main">
        <h1 className="public-page__title">Contact</h1>
        <div className="public-page__rule" aria-hidden="true" />
        <p className="public-page__lede">
          For queries on a specific case, a survey number, or an objection already on record,
          contact the district land acquisition office handling it &mdash; they hold the file
          and can act on it directly. For anything about the platform itself, write to the
          Department of Land Resources.
        </p>
        <dl className="notice-lookup__facts" style={{ marginTop: 'var(--s6)' }}>
          <div>
            <dt>Department of Land Resources</dt>
            <dd>Ministry of Rural Development, Government of India</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd><a href="mailto:contact@bhoomimitra.gov.in">contact@bhoomimitra.gov.in</a></dd>
          </div>
          <div>
            <dt>Office hours</dt>
            <dd>Monday&ndash;Friday, 9:30 AM&ndash;6:00 PM IST</dd>
          </div>
        </dl>
      </main>
      <PublicFooter />
    </div>
  );
}
