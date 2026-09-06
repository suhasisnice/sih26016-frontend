import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as dashboardApi from '../api/dashboard';
import * as adminApi from '../api/admin';
import * as referenceApi from '../api/reference';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can, isOversight } from '../auth/permissions';
import * as fmt from '../lib/format';
import { ruleLabel, severityLabel, stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import KpiTile from '../components/dashboard/KpiTile';
import TrendChart from '../components/dashboard/TrendChart';
import ForecastPanel from '../components/dashboard/ForecastPanel';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import StatusBadge from '../components/case/StatusBadge';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import '../components/dashboard/dashboard.css';

/* Five KPI tiles, an alerts panel with clickable rows, and the nine stages
   in statutory order.

   The five figures are fixed by the problem statement: area notified vs
   acquired, compensation awarded vs paid, affected families, R&R completion,
   and possession. Each one shows both halves of its ratio, because "₹4.82 Cr
   awarded" without "₹3.11 Cr paid" is the number that hides the problem. */
/* The six series /dashboard/trends returns, and how each one reads.

   They are in four different units, which is exactly why the chart shows one
   at a time: plotting rupees against hectares needs two y-axes, and a
   dual-axis chart lets whoever picked the scales decide which line looks like
   it is winning. */
const TREND_METRICS = [
  { key: 'cases_opened', label: 'Cases opened', format: (v) => fmt.count(Math.round(v)) },
  { key: 'cases_closed', label: 'Cases closed', format: (v) => fmt.count(Math.round(v)) },
  {
    key: 'stage_transitions',
    label: 'Stage transitions',
    format: (v) => fmt.count(Math.round(v)),
  },
  { key: 'notices_issued', label: 'Notices issued', format: (v) => fmt.count(Math.round(v)) },
  {
    key: 'compensation_paid',
    label: 'Compensation paid',
    format: (v, axis) => (axis ? fmt.rupeesShort(v) : fmt.rupeesShort(Math.round(v))),
  },
  {
    key: 'area_acquired_ha',
    label: 'Area acquired',
    format: (v) => `${(Number(v) || 0).toFixed(1)} ha`,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [severity, setSeverity] = useState('');
  const [metric, setMetric] = useState(TREND_METRICS[0].key);
  const [sweep, setSweep] = useState(null);

  /* A state or ministry officer reads across districts, so they get the
     scope selectors too — previously only an admin did, which left the two
     oversight roles looking at a national dashboard they could not narrow. */
  const canPickScope = user && (user.role === 'admin' || isOversight(user));

  const states = useApi((opts) => referenceApi.states(opts), [], { skip: !canPickScope });
  const districts = useApi(
    (opts) => referenceApi.districts(stateId ? Number(stateId) : undefined, opts),
    [stateId],
    // A district-scoped officer sees one district and cannot change it; the
    // filter would be a dropdown with a single option.
    { skip: !canPickScope },
  );
  const projects = useApi(
    (opts) => referenceApi.projects(districtId ? Number(districtId) : undefined, opts),
    [districtId],
    { skip: !canPickScope },
  );

  const scope = useMemo(
    () => ({
      state_id: stateId || undefined,
      district_id: districtId || undefined,
      project_id: projectId || undefined,
    }),
    [stateId, districtId, projectId],
  );

  const kpis = useApi((opts) => dashboardApi.kpis(scope, opts), [stateId, districtId, projectId]);
  const alerts = useApi(
    (opts) => dashboardApi.alerts({ ...scope, severity: severity || undefined, limit: 50 }, opts),
    [stateId, districtId, projectId, severity],
  );
  const stages = useApi((opts) => dashboardApi.casesByStage(opts), []);
  const trends = useApi(
    (opts) =>
      dashboardApi.trends(
        { state_id: stateId || undefined, district_id: districtId || undefined, months: 12 },
        opts,
      ),
    [stateId, districtId],
  );
  const forecast = useApi(
    (opts) => dashboardApi.forecast({ ...scope, limit: 12 }, opts),
    [stateId, districtId, projectId],
  );
  const attention = useApi(
    (opts) => dashboardApi.attention({ limit: 20 }, opts),
    [],
  );

  /* The manual trigger. The server also sweeps on a clock where the
     deployment sets RULES_INTERVAL_MINUTES, so this is "check now" rather
     than the only way rules ever run. Safe to press twice. */
  const runRules = useMutation(() => adminApi.runRules());

  async function onRunRules() {
    try {
      const result = await runRules.run();
      setSweep(result);
      alerts.reload();
      forecast.reload();
      attention.reload();
    } catch {
      /* useMutation holds the error; the button row renders it. */
    }
  }

  const stateOptions = (states.data || []).map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
  const districtOptions = (districts.data || []).map((d) => ({
    value: String(d.id),
    label: d.name,
  }));
  const projectOptions = (projects.data || []).map((p) => ({
    value: String(p.id),
    label: p.name,
  }));
  const activeMetric = TREND_METRICS.find((m) => m.key === metric) || TREND_METRICS[0];

  const alertColumns = [
    {
      key: 'severity',
      header: 'Severity',
      width: '108px',
      render: (row) => <StatusBadge kind="severity" value={row.severity} />,
      sortable: true,
      sortValue: (row) => ['low', 'medium', 'high', 'critical'].indexOf(row.severity),
    },
    {
      key: 'case_number',
      header: 'Case',
      width: '160px',
      sortable: true,
      render: (row) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.case_number}</span>,
    },
    {
      key: 'rule',
      header: 'Finding',
      width: '190px',
      sortable: true,
      render: (row) => ruleLabel(row.rule),
    },
    { key: 'message', header: 'Detail', render: (row) => row.message },
    {
      key: 'stage',
      header: 'Stage',
      width: '170px',
      sortable: true,
      render: (row) => <span style={{ color: 'var(--text-muted)' }}>{stageLabel(row.stage)}</span>,
    },
    {
      key: 'detected_on',
      header: 'Raised',
      width: '104px',
      sortable: true,
      render: (row) => fmt.date(row.detected_on),
    },
  ];

  return (
    <>
      <PageHeader
        title="Acquisition overview"
        subtitle={
          user && user.role === 'admin'
            ? 'Every district, as it stands today.'
            : 'Your district, as it stands today.'
        }
        actions={
          can.runRules(user) ? (
            <Button variant="secondary" onClick={onRunRules} disabled={runRules.pending}>
              {runRules.pending ? 'Checking…' : 'Run checks now'}
            </Button>
          ) : null
        }
      />

      {/* Scope. State cascades into district cascades into project, so a
          narrower choice never sits under a wider one that contradicts it —
          picking a state clears the district that no longer belongs to it. */}
      {canPickScope && (
        <div className="scope-bar">
          <Select
            label="State"
            value={stateId}
            placeholder="All states"
            options={stateOptions}
            onChange={(event) => {
              setStateId(event.target.value);
              setDistrictId('');
              setProjectId('');
            }}
          />
          <Select
            label="District"
            value={districtId}
            placeholder={stateId ? 'All districts in this state' : 'All districts'}
            options={districtOptions}
            onChange={(event) => {
              setDistrictId(event.target.value);
              setProjectId('');
            }}
          />
          <Select
            label="Project"
            value={projectId}
            placeholder={districtId ? 'All projects in this district' : 'All projects'}
            options={projectOptions}
            onChange={(event) => setProjectId(event.target.value)}
          />
        </div>
      )}

      {runRules.error && (
        <p className="sweep is-error">The checks could not run: {runRules.error.message}</p>
      )}
      {sweep && !runRules.error && (
        <p className="sweep">
          Checked {fmt.count(sweep.cases_evaluated)} cases · {fmt.count(sweep.alerts_generated)}{' '}
          findings · {fmt.count(sweep.notifications_created)} notifications to{' '}
          {fmt.count(sweep.notification_recipients)} officers.
        </p>
      )}

      {kpis.loading && <Loading label="Loading the figures" rows={5} />}
      {kpis.error && <ErrorState error={kpis.error} onRetry={kpis.reload} />}
      {kpis.data && <Kpis data={kpis.data} />}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Cases requiring attention</h2>
          <span className="section__count">{attention.data ? `${attention.data.total} cases` : ''}</span>
        </div>
        <AttentionPanel state={attention} />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">What needs attention</h2>
          <div style={{ minWidth: 180 }}>
            <Select
              label="Severity"
              value={severity}
              placeholder="All severities"
              options={['critical', 'high', 'medium', 'low'].map((value) => ({
                value,
                label: severityLabel(value),
              }))}
              onChange={(event) => setSeverity(event.target.value)}
            />
          </div>
        </div>

        {alerts.loading && <Loading label="Loading alerts" rows={6} />}
        {alerts.error && <ErrorState error={alerts.error} onRetry={alerts.reload} />}

        {alerts.data && (
          <>
            {alerts.data.total > 0 && (
              <p className="alert-summary" style={{ marginBottom: 'var(--s3)' }}>
                {Object.entries(alerts.data.by_severity || {})
                  .filter(([, n]) => n > 0)
                  .map(([key, n]) => (
                    <span key={key}>
                      <b>{n}</b> {severityLabel(key).toLowerCase()}
                    </span>
                  ))}
              </p>
            )}

            <DataTable
              columns={alertColumns}
              rows={alerts.data.items}
              getRowKey={(row) => row.id}
              onRowClick={(row) => navigate(`/cases/${row.case_id}`)}
              isRowFlagged={(row) => row.severity === 'critical'}
              initialSort={{ key: 'severity', direction: 'desc' }}
              caption={
                alerts.data.items.length
                  ? 'Raised by the rules engine on its last run. Select a row to open the case.'
                  : undefined
              }
              empty={
                <Empty
                  center
                  title="Nothing is overdue"
                  body={
                    severity
                      ? 'No findings at this severity. Clear the filter to see the rest.'
                      : 'No case in scope has tripped a rule. This is the state you want at a rehearsal, and it also means the rules have run.'
                  }
                />
              }
            />
          </>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Where cases stand</h2>
          <span className="section__count">
            {stages.data
              ? `${fmt.count(stages.data.reduce((sum, s) => sum + s.case_count, 0))} cases`
              : ''}
          </span>
        </div>

        {stages.loading && <Loading label="Loading the stage breakdown" rows={9} />}
        {stages.error && <ErrorState error={stages.error} onRetry={stages.reload} />}
        {stages.data && <StageBars rows={stages.data} onPick={(stage) => navigate(`/cases?stage=${stage}`)} />}
      </section>

      {/* The time dimension. Every other figure on this page is a snapshot of
          now, which cannot answer "are we speeding up or slowing down" — the
          question a reviewing officer actually asks. */}
      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Progress over twelve months</h2>
          <div style={{ minWidth: 210 }}>
            <Select
              label="Measure"
              value={metric}
              options={TREND_METRICS.map((m) => ({ value: m.key, label: m.label }))}
              onChange={(event) => setMetric(event.target.value)}
            />
          </div>
        </div>

        {trends.loading && <Loading label="Loading the trend" rows={5} />}
        {trends.error && <ErrorState error={trends.error} onRetry={trends.reload} />}
        {trends.data && (
          <TrendChart
            points={trends.data.points}
            metric={activeMetric.key}
            format={activeMetric.format}
          />
        )}
      </section>

      {/* The predictive half. The rules say what is wrong now; this says what
          is about to go wrong, and shows the signal behind every score. */}
      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Cases likely to slip</h2>
          <span className="section__count">worst first</span>
        </div>
        <ForecastPanel state={forecast} />
      </section>
    </>
  );
}

function Kpis({ data }) {
  const areaPercent = fmt.percent(data.area_acquired_ha, data.area_notified_ha);
  const paidPercent = fmt.percent(data.compensation_paid_total, data.compensation_awarded_total);
  /* rnr_entitled_count is every household with a resettlement record,
     whatever its status — the denominator, not one of the buckets. */
  const rnrTotal = data.rnr_entitled_count;
  const rnrPercent = fmt.percent(data.rnr_completed_count, rnrTotal);
  const possessionTotal = data.possession_taken_count + data.possession_pending_count;
  const possessionPercent = fmt.percent(data.possession_taken_count, possessionTotal);

  return (
    <div className="kpis">
      <KpiTile
        label="Land acquired"
        value={fmt.hectaresPlain(data.area_acquired_ha)}
        unit="ha"
        of={`of ${fmt.hectares(data.area_notified_ha)} notified`}
        meter={areaPercent}
      />

      <KpiTile
        label="Compensation paid"
        value={fmt.rupeesShort(data.compensation_paid_total)}
        of={`of ${fmt.rupeesShort(data.compensation_awarded_total)} awarded`}
        meter={paidPercent}
        split={[{ label: 'outstanding', value: fmt.rupeesShort(data.compensation_pending_total) }]}
      />

      <KpiTile
        label="Affected families"
        value={fmt.count(data.affected_families_count)}
        split={[
          { label: 'with title', value: fmt.count(data.affected_families_landowner_count) },
          { label: 'without title', value: fmt.count(data.affected_families_landless_count) },
        ]}
      />

      <KpiTile
        label="Resettlement completed"
        value={fmt.count(data.rnr_completed_count)}
        of={`of ${fmt.count(rnrTotal)} entitled households`}
        meter={rnrPercent}
        split={[
          { label: 'in progress', value: fmt.count(data.rnr_in_progress_count) },
          { label: 'not started', value: fmt.count(data.rnr_pending_count) },
          { label: 'disputed', value: fmt.count(data.rnr_disputed_count) },
        ]}
      />

      <KpiTile
        label="Possession taken"
        value={fmt.count(data.possession_taken_count)}
        unit="parcels"
        of={`of ${fmt.count(possessionTotal)} acquired`}
        meter={possessionPercent}
      />
    </div>
  );
}

/* The nine stages stay in statutory order. A chart sorted by size would read
   more cleanly and would destroy the one thing the sequence means. */
function StageBars({ rows, onPick }) {
  const max = Math.max(1, ...rows.map((row) => row.case_count));

  return (
    <div className="stage-bars">
      {rows.map((row) => (
        <button
          key={row.stage}
          type="button"
          className={`stage-bar${row.case_count === 0 ? ' is-empty' : ''}`}
          onClick={() => row.case_count > 0 && onPick(row.stage)}
          disabled={row.case_count === 0}
        >
          <span className="stage-bar__label">{stageLabel(row.stage)}</span>
          <span className="stage-bar__track">
            <span
              className="stage-bar__fill"
              style={{ width: `${(row.case_count / max) * 100}%` }}
            />
          </span>
          <span className="stage-bar__count">{row.case_count}</span>
        </button>
      ))}
    </div>
  );
}
