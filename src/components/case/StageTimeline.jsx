import { useEnums } from '../../hooks/useEnums';
import * as fmt from '../../lib/format';
import { stageLabel, stageSection } from '../../lib/labels';

/* The nine legal stages, always in statutory order, with where this case
   stands. The centrepiece of the case detail screen — treat it as the
   product, not a detail.

   `history` carries one row per transition actually recorded (`to_stage` +
   `changed_on`); a stage with no row is simply not reached yet, which reads
   correctly for a case created before this table existed too. */
export default function StageTimeline({ stage, history, stalledDays }) {
  const { stages } = useEnums();
  const order = stages.length ? stages : [stage];
  const currentIndex = order.indexOf(stage);

  const reachedOn = {};
  for (const entry of history || []) {
    // Keep the earliest date a stage was first reached — a case sent back
    // and re-advanced would otherwise show its second arrival.
    if (!reachedOn[entry.to_stage] || entry.changed_on < reachedOn[entry.to_stage]) {
      reachedOn[entry.to_stage] = entry.changed_on;
    }
  }

  return (
    <ol className="timeline">
      {order.map((value, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'ahead';
        const date = reachedOn[value];

        return (
          <li key={value} className={`timeline__step is-${state}`}>
            <span className="timeline__marker" aria-hidden="true">
              <span className="timeline__dot" />
            </span>
            <div className="timeline__body">
              <p className="timeline__label">
                {stageLabel(value)}
                {stageSection(value) && <span className="timeline__section">{stageSection(value)}</span>}
              </p>
              {state === 'done' && date && (
                <p className="timeline__meta">Reached {fmt.date(date)}</p>
              )}
              {state === 'current' && (
                <p className="timeline__meta">
                  {date ? `Since ${fmt.date(date)}` : 'Current stage'}
                  {typeof stalledDays === 'number' && ` · ${fmt.days(stalledDays)} here`}
                </p>
              )}
              {state === 'ahead' && <p className="timeline__meta timeline__meta--ahead">Not yet reached</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
