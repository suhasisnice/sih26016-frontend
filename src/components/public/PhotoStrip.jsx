import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

/* Bleeds off both edges of the viewport, tight against the sections above
   and below it — the one place on the landing page that breaks the grid on
   purpose. CLAUDE.md 4.2.

   This strip is also the one deliberate exception to CLAUDE.md 4.1's "no
   scale on hover" rule — a macOS-Dock-style magnification was asked for
   specifically, confirmed as an intentional one-off rather than a pattern
   to reuse elsewhere on the site. */
const PHOTOS = Array.from({ length: 11 }, (_, i) => `/photos/strip-${i + 1}.jpg`);

/* Two copies back-to-back, scrolled by exactly one copy's width (-50%) on a
   linear loop, is what makes the restart invisible — the pixels at the seam
   are identical to the pixels the strip opened on. */
const TRACK = [...PHOTOS, ...PHOTOS];

/* Falloff by physical distance in the rendered row, not by logical photo
   index — correct even for the two items that sit either side of the seam
   between the duplicated halves. */
function scaleFor(distance) {
  if (distance === 0) return 1.45;
  if (distance === 1) return 1.2;
  if (distance === 2) return 1.08;
  return 1;
}

export default function PhotoStrip() {
  const [activeIndex, setActiveIndex] = useState(null);
  const [hovering, setHovering] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const paused = hovering || activeIndex !== null;

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

  function activate(i) {
    if (activeIndex === i) {
      setLightbox(items[i]);
    } else {
      setActiveIndex(i);
    }
  }

  return (
    <>
      <div
        className="photo-strip"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false);
          setActiveIndex(null);
        }}
      >
        <div className="photo-strip__track" style={{ animationPlayState: paused ? 'paused' : 'running' }}>
          {items.map((item, i) => {
            const distance = activeIndex === null ? null : Math.abs(i - activeIndex);
            const scale = activeIndex === null ? 1 : scaleFor(distance);
            return (
              <div key={item.key} className="photo-strip__cell">
                <button
                  type="button"
                  className="photo-strip__item"
                  style={{
                    backgroundImage: `url(${item.src})`,
                    transform: `scale(${scale}) translateY(${scale > 1 ? -(scale - 1) * 60 : 0}px)`,
                    zIndex: activeIndex === null ? 1 : 100 - distance,
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  onFocus={() => setActiveIndex(i)}
                  onClick={() => activate(i)}
                  aria-label={`${item.caption} — open larger view`}
                />
              </div>
            );
          })}
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
