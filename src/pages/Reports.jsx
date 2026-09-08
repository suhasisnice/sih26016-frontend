import { useState } from 'react';
import * as exportsApi from '../api/exports';
import * as referenceApi from '../api/reference';
import { useApi } from '../hooks/useApi';
import { useEnums } from '../hooks/useEnums';
import { useAuth } from '../auth/AuthContext';
import { can, isOversight } from '../auth/permissions';
import { caseStatusLabel, stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import './reports.css';

/* MIS exports.

   Five registers, each downloaded as CSV with the filters that register
   actually supports, plus — on the case register — a choice of which
   columns to include and in what order. Still not a free-form report
   builder: every column name is checked server-side against the fixed set
   export_cases already computes (app.routers.exports.CASE_EXPORT_COLUMNS),
   so "customisable" means picking and ordering real columns, never naming
   an arbitrary field or touching the query behind them.

   Every download is scoped by the server to what the caller may see, so a
   district officer's "all districts" is their district. The filters here
   narrow that; they cannot widen it. */

const GROUPINGS = [
  { value: 'district', label: 'One row per district' },
  { value: 'state', label: 'One row per state' },
  { value: 'project', label: 'One row per project' },
  { value: 'stage', label: 'One row per stage' },
];

// Mirrors app.routers.exports.CASE_EXPORT_COLUMNS, in the same order — the
// order a reviewer sees the checkboxes in and, if they narrow the
// selection, the order the resulting CSV's columns come out in.
const CASE_COLUMNS = [
  { key: 'case_number', label: 'Case number' },
  { key: 'title', label: 'Title' },
  { key: 'state', label: 'State' },
  { key: 'district', label: 'District' },
  { key: 'village', label: 'Village' },
  { key: 'project', label: 'Project' },
  { key: 'stage', label: 'Stage' },
  { key: 'status', label: 'Status' },
  { key: 'opened_on', label: 'Opened on' },
  { key: 'stage_changed_on', label: 'Stage changed on' },
  { key: 'days_in_stage', label: 'Days in stage' },
  { key: 'stage_due_on', label: 'Stage due on' },
  { key: 'days_remaining', label: 'Days remaining' },
  { key: 'timeline_status', label: 'Timeline status' },
  { key: 'parcel_count', label: 'Parcel count' },
  { key: 'total_area_ha', label: 'Total area (ha)' },
];

const TREND_WINDOWS = [
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: '24', label: 'Last 24 months' },
];

export default function Reports() {
  const { user } = useAuth();
  const { stages, case_statuses: caseStatuses } = useEnums();

  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(null);
  const [filters, setFilters] = useState({
    state_id: '',
    district_id: '',
    stage: '',
    case_status: '',
    displaced_only: '',
    group_by: 'district',
    trend_months: '12',
  });
  // Empty means "all columns, default order" — the same thing omitting
  // `columns` from the request means server-side, so an untouched picker
  // and an unfiltered download stay in sync.
  const [caseColumns, setCaseColumns] = useState([]);

  const districts = useApi((opts) => referenceApi.districts(undefined, opts), []);
  const states = useApi((opts) => referenceApi.states(opts), [], {
    skip: !isOversight(user) && user?.role !== 'admin',
  });

  function set(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function toggleCaseColumn(key) {
    setCaseColumns((current) =>
      current.includes(key) ? current.filter((c) => c !== key) : [...current, key],
    );
  }

  async function download(kind, params) {
    setBusy(kind);
    setFailed(null);
    try {
      await exportsApi.download(kind, params);
    } catch (err) {
      setFailed({ kind, message: err.message });
    } finally {
      setBusy(null);
    }
  }

  const scope = {
    state_id: filters.state_id || undefined,
    district_id: filters.district_id || undefined,
  };

  const districtOptions = (districts.data || []).map((d) => ({
    value: String(d.id),
    label: d.name,
  }));
  const stateOptions = (states.data || []).map((s) => ({ value: String(s.id), label: s.name }));

  // CASE_COLUMNS order, not click order — so narrowing the picker never
  // scrambles the column order the full register already uses.
  const orderedCaseColumns = CASE_COLUMNS.map((c) => c.key).filter((key) =>
    caseColumns.includes(key),
  );

  const reports = [
    {
      kind: 'cases',
      title: 'Case register',
      body: 'Every case in scope with its stage, its deadline and how it is tracking against it. One row per case.',
      params: {
        ...scope,
        stage: filters.stage || undefined,
        case_status: filters.case_status || undefined,
        columns: orderedCaseColumns.length ? orderedCaseColumns.join(',') : undefined,
      },
      filters: (
        <>
          <Select
            label="Stage"
            value={filters.stage}
            placeholder="Any stage"
            options={stages.map((value) => ({ value, label: stageLabel(value) }))}
            onChange={(event) => set('stage', event.target.value)}
          />
          <Select
            label="Status"
            value={filters.case_status}
            placeholder="Any status"
            options={caseStatuses.map((value) => ({ value, label: caseStatusLabel(value) }))}
            onChange={(event) => set('case_status', event.target.value)}
          />
          <details className="report__columns">
            <summary>
              {orderedCaseColumns.length
                ? `${orderedCaseColumns.length} of ${CASE_COLUMNS.length} columns`
                : 'All columns'}
            </summary>
            <div className="report__columns-list">
              {CASE_COLUMNS.map((col) => (
                <label key={col.key} className="report__column-toggle">
                  <input
                    type="checkbox"
                    checked={caseColumns.includes(col.key)}
                    onChange={() => toggleCaseColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </details>
        </>
      ),
    },
    {
      kind: 'compensation',
      title: 'Compensation register',
      body: 'One row per beneficiary per case: what was awarded, what has been paid, and what is outstanding. Names against amounts — the most sensitive file here.',
      show: can.exportCompensation(user),
      params: scope,
    },
    {
      kind: 'families',
      title: 'Affected households',
      body: 'Every affected family with its R&R status, whether or not it holds title. The register behind the two family figures on the dashboard.',
      params: { ...scope, displaced_only: filters.displaced_only || undefined },
      filters: (
        <Select
          label="Households"
          value={filters.displaced_only}
          options={[
            { value: '', label: 'All affected' },
            { value: 'true', label: 'Displaced only' },
          ]}
          onChange={(event) => set('displaced_only', event.target.value)}
        />
      ),
    },
    {
      kind: 'kpis',
      title: 'Dashboard as a table',
      body: 'The same figures the dashboard shows, grouped by whichever dimension the review needs. A row here and a tile there cannot disagree — they are computed by the same code.',
      params: { group_by: filters.group_by, state_id: filters.state_id || undefined },
      filters: (
        <Select
          label="Grouped by"
          value={filters.group_by}
          options={GROUPINGS}
          onChange={(event) => set('group_by', event.target.value)}
        />
      ),
    },
    {
      kind: 'trends',
      title: 'Trends over time',
      body: 'Cases opened and closed, notices issued, compensation paid and area acquired, one row per month. The dashboard’s trend chart, as rows.',
      params: { ...scope, months: filters.trend_months },
      filters: (
        <Select
          label="Window"
          value={filters.trend_months}
          options={TREND_WINDOWS}
          onChange={(event) => set('trend_months', event.target.value)}
        />
      ),
    },
  ].filter((report) => report.show !== false);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Registers as CSV, scoped to what your office may see."
      />

      {/* Scope sits above the reports rather than being repeated inside each
          one: a reviewer picks the district once and then takes three files
          for it, and asking them four times would be its own small insult. */}
      <div className="reports__scope">
        <p className="reports__scope-label">Applies to every report below</p>
        <div className="reports__scope-fields">
          {stateOptions.length > 1 && (
            <Select
              label="State"
              value={filters.state_id}
              placeholder="All states in scope"
              options={stateOptions}
              onChange={(event) => set('state_id', event.target.value)}
            />
          )}
          <Select
            label="District"
            value={filters.district_id}
            placeholder={districts.loading ? 'Loading…' : 'All districts in scope'}
            options={districtOptions}
            onChange={(event) => set('district_id', event.target.value)}
          />
        </div>
      </div>

      <div className="reports">
        {reports.map((report) => (
          <section className="report" key={report.kind}>
            <div className="report__text">
              <h2 className="report__title">{report.title}</h2>
              <p className="report__body">{report.body}</p>
              {failed && failed.kind === report.kind && (
                <p className="report__error" role="alert">
                  {failed.message}
                </p>
              )}
            </div>

            {report.filters && <div className="report__filters">{report.filters}</div>}

            <div className="report__action">
              <Button
                variant="quiet"
                onClick={() => download(report.kind, report.params)}
                disabled={busy !== null}
              >
                {busy === report.kind ? 'Preparing…' : 'Download CSV'}
              </Button>
            </div>
          </section>
        ))}
      </div>

      <p className="reports__foot">
        Exports are capped so a mistaken filter cannot pull the national register
        in one file. If a download is refused for size, narrow it by state,
        district or stage and take it in parts.
      </p>
    </>
  );
}
