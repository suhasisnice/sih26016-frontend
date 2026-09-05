import { useMemo, useState } from 'react';
import * as publicRecordsApi from '../api/publicRecords';
import { useApi } from '../hooks/useApi';
import * as fmt from '../lib/format';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import { Select } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import '../components/public/public.css';
import './casestudies.css';

/* Real acquisitions, not invented ones — every record here traces to a
   government gazette or a published news report (the source line on each
   card names which), curated in data/real_acquisition_seed per that
   directory's own integrity rules: no invented coordinates, no estimated
   payments, no guessed ULPINs. Where the public record doesn't say, the
   card doesn't either.

   Unauthenticated, like Notices — a visitor deciding whether to trust this
   platform's account of how acquisition actually runs shouldn't need an
   account to check it against the record. */

const STATUS_LABEL = {
  acquired_declared: 'Acquisition declared',
  acquired_possession_taken: 'Possession taken',
  compensation_reported: 'Compensation reported',
  quashed_by_high_court: 'Quashed by High Court',
  ongoing: 'Ongoing',
};

/* Not app.core.enums — these are the free-text statuses public sources
   happen to use, so they get their own small local mapping rather than
   pretending to be one of the platform's own tracked enums. */
const STATUS_TONE = {
  acquired_declared: 'info',
  acquired_possession_taken: 'ok',
  compensation_reported: 'ok',
  quashed_by_high_court: 'danger',
  ongoing: 'warn',
};

function CaseStudyCard({ record, parcelCount }) {
  const tone = STATUS_TONE[record.status] || 'idle';
  const label = STATUS_LABEL[record.status] || (record.status ? record.status.replace(/_/g, ' ') : 'Status not reported');

  return (
    <article className="case-study">
      <div className="case-study__head">
        <h2 className="case-study__title">{record.project_name}</h2>
        <span className={`badge badge--${tone}`}>
          <span className="badge__dot" aria-hidden="true" />
          {label}
        </span>
      </div>

      {(record.department || record.implementing_agency) && (
        <p className="case-study__meta">
          {[record.department, record.implementing_agency].filter(Boolean).join(' · ')}
        </p>
      )}

      <p className="case-study__meta">
        {[record.village, record.taluk, record.district].filter(Boolean).join(', ')}
      </p>

      {(record.notification_type || record.notification_date) && (
        <p className="case-study__meta">
          {record.notification_type}
          {record.notification_no ? ` (${record.notification_no})` : ''}
          {record.notification_date ? ` — ${fmt.dateLong(record.notification_date)}` : ''}
        </p>
      )}

      {(record.area_ha != null || record.compensation_awarded != null || record.compensation_paid != null || parcelCount > 0) && (
        <dl className="case-study__stats">
          {record.area_ha != null && (
            <div>
              <dt>Area</dt>
              <dd>{fmt.hectares(record.area_ha)}{record.area_acres != null ? ` (${record.area_acres.toFixed(2)} acres)` : ''}</dd>
            </div>
          )}
          {record.compensation_awarded != null && (
            <div>
              <dt>Awarded</dt>
              <dd>{fmt.rupees(record.compensation_awarded)}</dd>
            </div>
          )}
          {record.compensation_paid != null && (
            <div>
              <dt>Paid</dt>
              <dd>{fmt.rupees(record.compensation_paid)}</dd>
            </div>
          )}
          {parcelCount > 0 && (
            <div>
              <dt>Parcels on record</dt>
              <dd>{fmt.count(parcelCount)}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="case-study__source">
        Source: {record.source}
        {record.source_reference ? ` — ${record.source_reference}` : ''}
      </p>
    </article>
  );
}

export default function CaseStudies() {
  const [district, setDistrict] = useState('');

  const records = useApi((opts) => publicRecordsApi.list({ limit: 200 }, opts), []);
  const summary = useApi((opts) => publicRecordsApi.summary(opts), []);

  const districtOptions = useMemo(() => {
    const seen = new Set();
    for (const record of (records.data || [])) {
      if (record.district) seen.add(record.district);
    }
    return [...seen].sort().map((name) => ({ value: name, label: name }));
  }, [records.data]);

  const { caseStudies, parcelCounts } = useMemo(() => {
    const items = records.data || [];
    const counts = new Map();
    for (const record of items) {
      if (record.record_type === 'parcel' && record.project_id) {
        counts.set(record.project_id, (counts.get(record.project_id) || 0) + 1);
      }
    }
    const studies = items
      .filter((record) => record.record_type !== 'parcel')
      .filter((record) => !district || record.district === district);
    return { caseStudies: studies, parcelCounts: counts };
  }, [records.data, district]);

  return (
    <div className="public">
      <PublicHeader />

      <main className="public-page" id="main">
        <h1 className="public-page__title">Case studies</h1>
        <div className="public-page__rule" aria-hidden="true" />

        <p className="public-page__lede">
          Real acquisitions, drawn from published gazette notices and news reports rather
          than invented for a demo. Each card below names its source; where a figure —
          compensation, a survey number, a payment date — was never made public, the card
          leaves it blank rather than estimating it.
        </p>

        {summary.data && (
          <p className="case-studies__summary">
            {fmt.count(summary.data.project_records.count)} acquisitions verified across{' '}
            {districtOptions.length} district{districtOptions.length === 1 ? '' : 's'} ·{' '}
            {fmt.hectares(summary.data.project_records.area_ha_reported)} reported ·{' '}
            {fmt.count(summary.data.parcel_records.count)} individual parcels on record ·{' '}
            {fmt.rupees(summary.data.compensation_records.compensation_paid_reported)} in
            confirmed payments
          </p>
        )}

        {districtOptions.length > 1 && (
          <div className="public-page__filters">
            <Select
              label="District"
              value={district}
              placeholder="All districts"
              options={districtOptions}
              onChange={(event) => setDistrict(event.target.value)}
            />
          </div>
        )}

        {records.loading && <Loading label="Loading case studies" rows={4} />}
        {records.error && <ErrorState error={records.error} onRetry={records.reload} />}

        {records.data && caseStudies.length === 0 && (
          <Empty
            title="No case studies here"
            body="Nothing verified matches this filter yet. Widen it to see the rest."
          />
        )}

        {records.data && caseStudies.length > 0 && (
          <div className="case-study-list">
            {caseStudies.map((record) => (
              <CaseStudyCard
                key={record.id}
                record={record}
                parcelCount={parcelCounts.get(record.project_id) || 0}
              />
            ))}
          </div>
        )}

        <p className="case-studies__footnote">
          Owner and interested-person names are shown only where a public schedule already
          named them, per the acquisition Act's own publication requirement — never added
          from any other source. See the data directory's own integrity notes for exactly
          what was and wasn't imported.
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}
