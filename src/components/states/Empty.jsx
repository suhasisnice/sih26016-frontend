/* The third required state — CLAUDE.md 2, rule 7. `center` is for a panel
   or table slot where the empty message should sit mid-column rather than
   flush left with everything else on the page. */
export default function Empty({ title, body, center = false }) {
  return (
    <div className={`empty-state${center ? ' empty-state--center' : ''}`}>
      <p className="empty-state__title">{title}</p>
      {body && <p className="empty-state__body">{body}</p>}
    </div>
  );
}
