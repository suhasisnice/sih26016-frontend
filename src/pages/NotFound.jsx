import PublicHeader from '../components/public/PublicHeader';
import Button from '../components/ui/Button';
import '../components/public/public.css';

export default function NotFound() {
  return (
    <div className="public">
      <PublicHeader />
      <main className="public-page" id="main">
        <h1 className="public-page__title">That page does not exist</h1>
        <div className="public-page__rule" aria-hidden="true" />
        <p className="public-page__lede">
          The address may have changed, or the case it pointed to may have been
          closed.
        </p>
        <div style={{ marginTop: 'var(--s5)' }}>
          <Button to="/" variant="primary">Home</Button>
        </div>
      </main>
    </div>
  );
}
