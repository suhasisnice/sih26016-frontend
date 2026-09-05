/* One of the five (or more, on CaseList) KPI tiles. Shows both halves of a
   ratio deliberately — "₹4.82 Cr awarded" with no "paid" figure beside it is
   the number that hides the problem. */
export default function KpiTile({ label, value, unit, of, meter, split, accent, icon: Icon }) {
  const toneClass = accent && accent !== 'neutral' ? ` kpi--${accent}` : '';
  return (
    <div className={`kpi${toneClass}`}>
      <div className="kpi__head">
        <span className="kpi__label">{label}</span>
        {Icon && (
          <span className="kpi__icon" aria-hidden="true">
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
      </div>

      <div className="kpi__value">
        {value}
        {unit && <span className="kpi__value-unit">{unit}</span>}
      </div>

      {of && <p className="kpi__of">{of}</p>}

      {typeof meter === 'number' && (
        <div className="kpi__meter">
          <div className="kpi__meter-fill" style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </div>
      )}

      {split && split.length > 0 && (
        <div className="kpi__split">
          {split.map((item) => (
            <span key={item.label} className="kpi__split-item">
              <span className="kpi__split-value">{item.value}</span> {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
