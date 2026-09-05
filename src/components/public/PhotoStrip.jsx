import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

/* Bleeds off both edges of the viewport, tight against the sections above
   and below it — the one place on the landing page that breaks the grid on
   purpose. CLAUDE.md 4.2. A continuous, seamlessly looping marquee that
   pauses on hover; click a card to open it larger. */
const PHOTOS = Array.from({ length: 11 }, (_, i) => `/photos/strip-${i + 1}.jpg`);

/* Two copies back-to-back, scrolled by exactly one copy's width (-50%) on a
   linear loop, is what makes the restart invisible — the pixels at the seam
   are identical to the pixels the strip opened on. */
const TRACK = [...PHOTOS, ...PHOTOS];

export default function PhotoStrip() {
  const [hovering, setHovering] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const items = useMemo(
    () =>
      TRACK.map((src, i) => ({
        src,
        key: `${src}-${i}`,
        caption: `Land acquisition project site, photograph ${(i % PHOTOS.length) + 1}`,
      })),
    [],
  );

  useEffect(() => {
    if (!lightbox) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setLightbox(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  return (
    <>
      <div
        className="photo-strip"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="photo-strip__track" style={{ animationPlayState: hovering ? 'paused' : 'running' }}>
          {items.map((item) => (
            <div key={item.key} className="photo-strip__cell">
              <button
                type="button"
                className="photo-strip__item"
                style={{ backgroundImage: `url(${item.src})` }}
                onClick={() => setLightbox(item)}
                aria-label={`${item.caption} — open larger view`}
              />
            </div>
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.caption}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightbox(null);
          }}
        >
          <button
            type="button"
            className="photo-lightbox__close"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          <img src={lightbox.src} alt={lightbox.caption} className="photo-lightbox__image" />
        </div>
      )}
    </>
  );
}
