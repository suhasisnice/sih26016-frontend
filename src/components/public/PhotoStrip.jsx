/* Bleeds off both edges of the viewport, tight against the sections above
   and below it — the one place on the landing page that breaks the grid on
   purpose. CLAUDE.md 4.2. */
const PHOTOS = Array.from({ length: 11 }, (_, i) => `/photos/strip-${i + 1}.jpg`);

export default function PhotoStrip() {
  return (
    <div className="photo-strip" aria-hidden="true">
      {PHOTOS.map((src) => (
        <div key={src} className="photo-strip__item" style={{ backgroundImage: `url(${src})` }} />
      ))}
    </div>
  );
}
