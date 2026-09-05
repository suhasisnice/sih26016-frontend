import { useId } from 'react';

/* Input, Select and Textarea — no form library, just these plus
   lib/validate.js. Every field is label + control + optional hint, with the
   error replacing the hint when there is one, so the two never stack. */

function FieldShell({ id, label, error, hint, children }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ label, error, hint, className = '', ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        className={`field__control${error ? ' is-invalid' : ''} ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export function Textarea({ label, error, hint, className = '', rows = 4, ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        rows={rows}
        className={`field__control field__control--textarea${error ? ' is-invalid' : ''} ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

/* `placeholder` renders as a disabled first option — a native select has no
   real placeholder, and this is the version that still shows as unselected
   until a real option is chosen. */
export function Select({ label, error, hint, placeholder, options, value, className = '', ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        value={value}
        className={`field__control field__control--select${error ? ' is-invalid' : ''} ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
