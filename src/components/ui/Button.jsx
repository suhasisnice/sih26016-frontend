import { Link } from 'react-router-dom';

/* One button component for the whole product. Filled only — primary is
   `--brand`, secondary is `--brand-soft`, quiet has no fill at all. Never
   outlined, never ghost, never an icon inside it. CLAUDE.md 3.4.

   Renders a <Link> when `to` is given, a native <button> otherwise, so a
   navigation action is a real link (open in new tab, right-click, ⌘-click
   all work) rather than an onClick pretending to be one. */
export default function Button({
  to,
  variant = 'secondary',
  size = 'md',
  block = false,
  type = 'button',
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (to && !disabled) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}
