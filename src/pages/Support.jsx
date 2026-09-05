import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import '../components/public/public.css';

export default function Support() {
  return (
    <div className="public">
      <PublicHeader />
      <main className="public-page" id="main">
        <h1 className="public-page__title">Support</h1>
        <div className="public-page__rule" aria-hidden="true" />
        <p className="public-page__lede">
          Trouble signing in, a document that will not upload, or a case that looks wrong on
          screen &mdash; the technical support desk handles the platform, not the acquisition
          itself. If your question is about the status of your land, see{' '}
          <a href="/contact">Contact</a> instead.
        </p>
        <dl className="notice-lookup__facts" style={{ marginTop: 'var(--s6)' }}>
          <div>
            <dt>Technical support</dt>
            <dd><a href="mailto:support@bhoomimitra.gov.in">support@bhoomimitra.gov.in</a></dd>
          </div>
          <div>
            <dt>Response time</dt>
            <dd>Within two working days</dd>
          </div>
        </dl>
      </main>
      <PublicFooter />
    </div>
  );
}
