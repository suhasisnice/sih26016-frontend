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

   Four registers, each downloaded as CSV with the filters that register
   actually supports — not a report builder. The statement asks for
   "customisable MIS reports", and this is the honest reading of that: the
   same figures the dashboard shows, grouped the way the reviewer needs them,
   in a file that opens in the spreadsheet they were going to paste it into
   anyway.

   Every download is scoped by the server to what the caller may see, so a
   district officer's "all districts" is their district. The filters here
   narrow that; they cannot widen it. */

const GROUPINGS = [
  { value: 'district', label: 'One row per district' },
  { value: 'state', label: 'One row per state' },
  { value: 'project', label: 'One row per project' },
  { value: 'stage', label: 'One row per stage' },
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
  });

  const districts = useApi((opts) => referenceApi.districts(undefined, opts), []);
  const states = useApi((opts) => referenceApi.states(opts), [], {
    skip: !isOversight(user) && user?.role !== 'admin',
  });

  function set(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
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

  const reports = [
    {
      kind: 'cases',
      title: 'Case register',
      body: 'Every case in scope with its stage, its deadline and how it is tracking against it. One row per case.',
      params: {
        ...scope,
        stage: filters.stage || undefined,
        case_status: filters.case_status || undefined,
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
