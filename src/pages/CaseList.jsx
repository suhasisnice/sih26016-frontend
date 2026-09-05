import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FolderKanban, TrendingUp } from 'lucide-react';
import * as casesApi from '../api/cases';
import * as referenceApi from '../api/reference';
import { useApi } from '../hooks/useApi';
import { useEnums } from '../hooks/useEnums';
import { useAuth } from '../auth/AuthContext';
import { can, isLandowner } from '../auth/permissions';
import * as fmt from '../lib/format';
import { stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/case/StatusBadge';
import KpiTile from '../components/dashboard/KpiTile';
import FilterBar from '../components/ui/FilterBar';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import './caselist.css';

const PAGE_SIZE = 20;

/* A case that has sat in one stage past this reads as drifting, and its row
   is marked. It matches STALLED_DAYS in the AI layer's constants, so the
   list and the dashboard's alerts agree about what "stuck" means. */
const STALLED_DAYS = 10;

/* Built to the Figma "Case List" frame. Two things there don't map onto our
   domain and were swapped for what actually exists rather than invented:

   - The frame's five-value pipeline (Pending/In progress/Closed/Rejected)
     doesn't match the API's three real case_statuses (active/stalled/
     closed) — the tab strip below uses ours, and there is no separate
     "Status" dropdown in the filter bar, since a tab strip and a dropdown
     over the same three values would be the same control twice.
   - The frame's "Priority" column (High/Medium/Low/Critical) has no backing
     field on a case. `timeline_status` — on_time/at_risk/breached, already
     computed by the API — answers the same "how urgent is this row" question
     honestly, so it fills that column instead. */
export default function CaseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const enums = useEnums();
  const [params, setParams] = useSearchParams();

  const stage = params.get('stage') || '';
  const caseStatus = params.get('case_status') || '';
  const districtId = params.get('district_id') || '';
  const projectId = params.get('project_id') || '';
  const page = Number(params.get('page') || 1);

  const [searchInput, setSearchInput] = useState(params.get('search') || '');
  const search = params.get('search') || '';

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput === search) return;
      update({ search: searchInput, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in changes)) next.set('page', '1');
    setParams(next, { replace: true });
  }

  const districts = useApi((opts) => referenceApi.districts(undefined, opts), [], {
    skip: user && user.role !== 'admin',
  });

  const projects = useApi(
    (opts) => referenceApi.projects(districtId || undefined, opts),
    [districtId],
    { skip: isLandowner(user) },
  );

  const query = useMemo(
    () => ({
      stage: stage || undefined,
      case_status: caseStatus || undefined,
      district_id: districtId || undefined,
      project_id: projectId || undefined,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [stage, caseStatus, districtId, projectId, search, page],
  );

  const cases = useApi((opts) => casesApi.list(query, opts), [
    stage,
    caseStatus,
    districtId,
    projectId,
    search,
    page,
  ]);

  /* The tab strip and the KPI row both need whole-scope counts per status —
     not the count of the currently filtered page. Three cheap requests
     (limit=1, only `total` is read) rather than inventing a summary
     endpoint for four numbers. */
  const totalAll = useApi((opts) => casesApi.list({ limit: 1 }, opts), []);
  const totalActive = useApi(
    (opts) => casesApi.list({ case_status: 'active', limit: 1 }, opts),
    [],
  );
  const totalStalled = useApi(
    (opts) => casesApi.list({ case_status: 'stalled', limit: 1 }, opts),
    [],
  );
  const totalClosed = useApi(
    (opts) => casesApi.list({ case_status: 'closed', limit: 1 }, opts),
    [],
  );

  const scopeCounts = {
    all: totalAll.data?.total,
    active: totalActive.data?.total,
    stalled: totalStalled.data?.total,
    closed: totalClosed.data?.total,
  };

  const hasFilters = Boolean(stage || caseStatus || districtId || projectId || search);

  const columns = [
    {
      key: 'case_number',
      header: 'Case ID',
      width: '150px',
      sortable: true,
      render: (row) => <span className="case-number">{row.case_number}</span>,
    },
    {
      key: 'title',
      header: 'Land / Location',
      sortable: true,
      render: (row) => (
        <div className="case-cell">
          <span className="case-cell__title">{row.title}</span>
          <span className="case-cell__meta">
            {row.village_name}, {row.district_name}
          </span>
        </div>
      ),
    },
    {
      key: 'project_name',
      header: 'Project',
      width: '190px',
      sortable: true,
    },
    {
      key: 'stage',
      header: 'Current stage',
      width: '180px',
      sortable: true,
      sortValue: (row) => enums.stages.indexOf(row.stage),
      render: (row) => <span className="case-stage">{stageLabel(row.stage)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      sortable: true,
      render: (row) => <StatusBadge kind="case" value={row.status} />,
    },
    {
      key: 'timeline_status',
      header: 'Timeline',
      width: '110px',
      sortable: true,
      render: (row) => <StatusBadge kind="timeline" value={row.timeline_status} />,
    },
    {
      key: 'stage_changed_at',
      header: 'Last activity',
      width: '150px',
      align: 'num',
      sortable: true,
      render: (row) => (
        <div className="case-cell case-cell--num">
          <span>{fmt.date(row.stage_changed_at)}</span>
          <span
            className={`case-cell__meta${
              row.days_in_stage >= STALLED_DAYS ? ' is-overdue' : ''
            }`}
          >
            {fmt.days(row.days_in_stage)} in stage
          </span>
        </div>
      ),
    },
  ];

  const total = cases.data ? cases.data.total : 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const TABS = [
    { value: '', label: 'All cases', count: scopeCounts.all },
    { value: 'active', label: 'Active', count: scopeCounts.active },
    { value: 'stalled', label: 'Stalled', count: scopeCounts.stalled },
    { value: 'closed', label: 'Closed', count: scopeCounts.closed },
  ];

  return (
    <>
      <PageHeader
        eyebrow={['Case management', user?.district_name || user?.state_name || 'National']}
        title={isLandowner(user) ? 'Your acquisition' : 'Case list'}
        subtitle={
          isLandowner(user)
            ? 'Every case that touches land recorded in your name.'
            : 'Track land-acquisition cases, unblock delays, and keep every stakeholder aligned.'
        }
        actions={
          can.createCase(user) ? (
            <Button to="/cases/new" variant="primary">
              New case
            </Button>
          ) : null
        }
      />

      {!isLandowner(user) && (
        <>
          <FilterBar>
            <FilterBar.Search
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by case number, village or project…"
            />
            {districts.data && districts.data.length > 1 && (
              <FilterBar.Select
                label="District"
                value={districtId}
                placeholder="All districts"
                options={districts.data.map((d) => ({ value: String(d.id), label: d.name }))}
                onChange={(event) => update({ district_id: event.target.value, project_id: '' })}
              />
            )}
            <FilterBar.Select
              label="Project"
              value={projectId}
              placeholder="All projects"
              options={(projects.data || []).map((p) => ({ value: String(p.id), label: p.name }))}
              onChange={(event) => update({ project_id: event.target.value })}
            />
            <FilterBar.Select
              label="Stage"
              value={stage}
              placeholder="All stages"
              options={enums.stages.map((value) => ({ value, label: stageLabel(value) }))}
              onChange={(event) => update({ stage: event.target.value })}
            />
            <FilterBar.Actions
              hasFilters={hasFilters}
              filterCount={[stage, districtId, projectId, search].filter(Boolean).length}
              onClear={() => {
                setSearchInput('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            />
          </FilterBar>

          <div className="kpis kpis--case-list">
            <KpiTile
              label="Total cases"
              value={fmt.count(scopeCounts.all)}
              of={user?.district_name ? `Across ${user.district_name}` : 'Across all districts'}
              accent="neutral"
              icon={FolderKanban}
            />
            <KpiTile
              label="Attention needed"
              value={fmt.count(scopeCounts.stalled)}
              of="Stalled ten days or more"
              accent="danger"
              icon={AlertTriangle}
            />
            <KpiTile
              label="Active"
              value={fmt.count(scopeCounts.active)}
              of="Moving through statutory stages"
              accent="info"
              icon={TrendingUp}
            />
            <KpiTile
              label="Closed"
              value={fmt.count(scopeCounts.closed)}
              of="Reached final possession"
              accent="ok"
              icon={CheckCircle2}
            />
          </div>

          <div className="case-tabs" role="tablist" aria-label="Filter by status">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={caseStatus === tab.value}
                className={`case-tabs__tab${caseStatus === tab.value ? ' is-active' : ''}`}
                onClick={() => update({ case_status: tab.value })}
              >
                {tab.label}
                <span className="case-tabs__count">
                  {tab.count === undefined ? '…' : fmt.count(tab.count)}
                </span>
              </button>
            ))}
            {cases.data && (
              <span className="case-tabs__showing">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                {fmt.count(total)} cases
              </span>
            )}
          </div>
        </>
      )}

      {cases.loading && <Loading label="Loading cases" rows={8} />}
      {cases.error && <ErrorState error={cases.error} onRetry={cases.reload} />}

      {cases.data && (
        <>
          <DataTable
            columns={columns}
            rows={cases.data.items}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(`/cases/${row.id}`)}
            isRowFlagged={(row) => row.days_in_stage >= STALLED_DAYS || row.status === 'stalled'}
            empty={
              <Empty
                center
                title={hasFilters ? 'No case matches those filters' : 'No cases yet'}
                body={
                  hasFilters
                    ? 'Widen or clear the filters to see the rest of the caseload.'
                    : isLandowner(user)
                      ? 'No acquisition currently records land in your name. If you believe that is wrong, the district office holds the land records.'
                      : 'Nothing has been notified in your jurisdiction yet.'
                }
              />
            }
            caption={
              cases.data.items.length
                ? 'A red rule marks a case that has sat in one stage for ten days or more.'
                : undefined
            }
          />

          {total > PAGE_SIZE && (
            <div className="pager">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                {fmt.count(total)}
              </span>
              <span className="pager__controls">
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => update({ page: page - 1 })}
                >
                  Previous
                </Button>
                <span className="pager__page">
                  Page {page} of {lastPage}
                </span>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => update({ page: page + 1 })}
                >
                  Next
                </Button>
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}
