import { useEffect } from 'react';
import { X } from 'lucide-react';

/* One modal for the whole product — a confirm step, a small form, nothing
   more elaborate. It is one of the only two things in the product that get
   a shadow (the other is the map popup), because it genuinely floats above
   everything else. CLAUDE.md 4.2. */
export default function Modal({ open, onClose, title, subtitle, footer, busy, error, children }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="modal__body">
          {error && <p className="modal__error" role="alert">{error.message}</p>}
          {children}
        </div>

        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
