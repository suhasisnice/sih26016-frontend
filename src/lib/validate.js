/* Small validation helpers. No form library — controlled inputs plus these.

   Every validator returns an error string or null, so a form's rules read as
   a flat object and `validate()` collects them in one pass. */

export const required = (label) => (value) =>
  value === null || value === undefined || String(value).trim() === ''
    ? `${label} is required`
    : null;

export const minLength = (label, n) => (value) =>
  value && String(value).trim().length < n
    ? `${label} must be at least ${n} characters`
    : null;

export const maxLength = (label, n) => (value) =>
  value && String(value).length > n ? `${label} must be ${n} characters or fewer` : null;

export const isNumber = (label) => (value) =>
  value !== '' && value !== null && Number.isNaN(Number(value)) ? `${label} must be a number` : null;

export const notNegative = (label) => (value) =>
  value !== '' && Number(value) < 0 ? `${label} cannot be negative` : null;

/* Indian mobile numbers are ten digits starting 6–9. Optional field, so an
   empty value passes — required() is what makes a field mandatory. */
export const phone = (label) => (value) => {
  if (!value) return null;
  return /^[6-9]\d{9}$/.test(String(value).trim())
    ? null
    : `${label} must be a 10-digit mobile number`;
};

/* Survey numbers look like 127/2A, 88/1B or 304. Kept permissive — record
   formats vary between states and rejecting a real one is worse than
   accepting an odd one. */
export const surveyNumber = (label) => (value) => {
  if (!value) return null;
  return /^[0-9]+(\/[0-9]+[A-Za-z]?)?$/.test(String(value).trim())
    ? null
    : `${label} should look like 127/2A or 304`;
};

/* Runs a {field: [rule, rule]} spec over a values object.
   Returns {errors, isValid} — the first failing rule per field wins, because
   showing a person four problems with one input at once is not help. */
export function validate(values, rules) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    for (const rule of fieldRules) {
      const error = rule(values[field]);
      if (error) {
        errors[field] = error;
        break;
      }
    }
  }
  return { errors, isValid: Object.keys(errors).length === 0 };
}
