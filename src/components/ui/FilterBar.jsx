import { Search, X } from 'lucide-react';

/* The filter row above a list screen: a search box, a run of compact
   selects, and a clear action — assembled as a compound component so a page
   picks exactly the controls it needs in the order it needs them. */
function FilterBar({ children }) {
  return <div className="filter-bar">{children}</div>;
}

FilterBar.Search = function FilterBarSearch({ value, onChange, placeholder }) {
  return (
    <div className="filter-bar__search">
      <Search size={15} strokeWidth={1.75} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
};

FilterBar.Select = function FilterBarSelect({ label, value, placeholder, options, onChange, disabled }) {
  return (
    <label className="filter-bar__select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={onChange} disabled={disabled} aria-label={label}>
        {placeholder && <option value="">{placeholder}</option>}
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
};

FilterBar.Actions = function FilterBarActions({ hasFilters, filterCount, onClear }) {
  if (!hasFilters) return null;
  return (
    <button type="button" className="filter-bar__clear" onClick={onClear}>
      <X size={13} strokeWidth={2} aria-hidden="true" />
      Clear{filterCount ? ` (${filterCount})` : ''}
    </button>
  );
};

export default FilterBar;
