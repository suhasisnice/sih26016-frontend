import { AlertOctagon } from 'lucide-react';

/* One of the three required states — CLAUDE.md 2, rule 7. `error` is the
   ApiError api/client.js normalises every failure into, so `.message` is
   always something a person can read without a developer translating it. */
export default function ErrorState({ error, title, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <AlertOctagon size={18} strokeWidth={1.75} aria-hidden="true" />
      <div>
        <p className="error-state__title">{title || 'That could not be loaded'}</p>
        <p className="error-state__body">
          {(error && error.message) || 'Something went wrong. Try again.'}
        </p>
        {onRetry && (
          <button type="button" className="error-state__retry" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
