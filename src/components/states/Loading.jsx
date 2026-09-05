/* Loading. One of the three states every screen must handle — CLAUDE.md 2,
   rule 7 — built once so nobody has to remember the other two.

   `inline` drops the label for a panel that already has its own heading
   (a sidebar card mid-page), so the same skeleton doesn't repeat "Loading…"
   under a dozen headings on one screen. */
export default function Loading({ label, rows = 4, inline = false }) {
  return (
    <div className={`loading${inline ? ' loading--inline' : ''}`} role="status" aria-live="polite">
      {label && !inline && <span className="sr-only">{label}</span>}
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="loading__row" style={{ width: `${86 - (i % 3) * 14}%` }} />
      ))}
    </div>
  );
}
