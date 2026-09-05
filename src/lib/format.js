/* Every date, rupee, hectare and survey number in the product is rendered
   here. One place, so the app cannot show three date formats on three
   screens. CLAUDE.md 2, rule 3. */

/* Money arrives as integers in whole rupees — never floats. Rendered with
   Indian digit grouping: ₹12,34,567, not ₹1,234,567. */
const RUPEE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const RUPEE_PLAIN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function rupees(value) {
  if (value === null || value === undefined) return '—';
  return RUPEE.format(value);
}

/* For tables, where a column header already says the unit and repeating the
   symbol on every row is noise. */
export function rupeesPlain(value) {
  if (value === null || value === undefined) return '—';
  return RUPEE_PLAIN.format(value);
}

/* Large sums on KPI tiles, where ₹4,82,61,900 is unreadable at a glance.
   Indian units — lakh and crore — because the audience reads those, not
   millions. */
export function rupeesShort(value) {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return RUPEE.format(value);
}

export function hectares(value) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(2)} ha`;
}

/* Just the number, for a table cell whose header carries the unit. */
export function hectaresPlain(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(2);
}

/* Dates arrive as ISO strings, some with a time and some without. The domain
   has no time of day for a stage change, so nothing renders one. */
export function date(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function dateLong(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/* Audit entries are the one place a time matters — two edits on the same day
   need to be tellable apart. */
export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function days(value) {
  if (value === null || value === undefined) return '—';
  if (value === 0) return 'today';
  if (value === 1) return '1 day';
  return `${value} days`;
}

/* Survey numbers are identifiers, not prose — they keep their exact form
   (127/2A, 88/1B, 304) and are set in the mono stack wherever they appear. */
export function surveyNumber(value) {
  return value || '—';
}

export function count(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

/* A percentage where the denominator can legitimately be zero — an early-stage
   case has nothing awarded yet, and 0/0 must read as "—", not "NaN%" or
   "100%". */
export function percent(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 100);
}
