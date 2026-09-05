import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/* Every application screen opens with this: an optional back link, an
   optional eyebrow (section · scope), the title, a subtitle, and whatever
   actions belong on this page. One eyebrow use in the whole product would be
   the rule (CLAUDE.md 4.1) if this were the public site; here it is doing a
   real job — saying which office and which slice of it a working screen
   belongs to — so it earns its place on every application page instead. */
export default function PageHeader({ eyebrow, back, title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {back && (
          <Link to={back.to} className="page-header__back">
            <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
            {back.label}
          </Link>
        )}
        {eyebrow && (
          <p className="page-header__eyebrow">
            {eyebrow.filter(Boolean).join(' · ')}
          </p>
        )}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
