/* A twelve-month line, drawn as plain inline SVG. No charting dependency —
   CLAUDE.md 5 makes recharts conditional on "a chart genuinely needed", and
   one line over twelve points does not need a library the container would
   otherwise carry for nothing. */

const WIDTH = 760;
const HEIGHT = 220;
const PAD_X = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export default function TrendChart({ points, metric, format }) {
  if (!points || points.length === 0) return null;

  const values = points.map((p) => Number(p[metric]) || 0);
  const max = Math.max(1, ...values);
  const innerWidth = WIDTH - PAD_X * 2;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = values.map((v, i) => ({
    x: PAD_X + stepX * i,
    y: PAD_TOP + innerHeight - (v / max) * innerHeight,
    v,
    period: points[i].period,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${PAD_TOP + innerHeight} L${coords[0].x.toFixed(1)},${PAD_TOP + innerHeight} Z`;

  // Every point on a mobile-width chart is unreadable; thin the x-axis
  // labels to at most six, always keeping the first and last.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${metric} over time`}>
        <path d={areaPath} className="trend-chart__area" />
        <path d={linePath} className="trend-chart__line" />
        {coords.map((c, i) => (
          <circle key={c.period} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 3.5 : 2.5} className="trend-chart__dot" />
        ))}
        {coords.map((c, i) =>
          i % labelEvery === 0 || i === coords.length - 1 ? (
            <text key={c.period} x={c.x} y={HEIGHT - 8} className="trend-chart__label" textAnchor="middle">
              {c.period.slice(5)}/{c.period.slice(2, 4)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="trend-chart__latest">
        <span className="trend-chart__latest-value">{format(values[values.length - 1])}</span>
        <span className="trend-chart__latest-label">most recent month</span>
      </div>
    </div>
  );
}
