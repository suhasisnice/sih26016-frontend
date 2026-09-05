import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as casesApi from '../api/cases';
import { useApi } from '../hooks/useApi';
import * as fmt from '../lib/format';
import { stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import DataTable from '../components/ui/DataTable';
import FilterBar from '../components/ui/FilterBar';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import './audittrail.css';

/* Built to the Figma "Audit Trail" frame — its own page, not a panel inside
   CaseDetail, with a filter bar and a case-context sidebar.

   Two things there don't exist in the data and were swapped for what does:

   - The frame's "Event type" dropdown (Case Created/Document Upload/
     Valuation/...) reads as free labels on invented categories. The real
     field that plays that role is `entity_type` — what kind of record the
     entry is about (case/document/objection) — so the filter runs over
     that instead.
   - The frame shows a per-row "Status" (Success/In progress). Nothing in
     an audit entry records an outcome — it is a fact that something
     happened, not a job that can still be running — so that column is not
     reproduced rather than invented.

   The API takes only `limit`, no server-side search or date range, so
   filtering runs client-side over the fetched entries. Reasonable for one
   case's history; it would not be for a system-wide log. */
const ENTITY_LABEL = {
  case: 'Case',
  document: 'Document',
  objection: 'Objection',
};

/* A stable reference for the "not loaded yet" case — `[]` inline would be a
   fresh array every render, which defeats the two useMemo calls below. */
const NO_ENTRIES = [];

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function AuditTrail() {
  const { caseId } = useParams();
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [days, setDays] = useState('');

  const detail = useApi((opts) => casesApi.get(caseId, opts), [caseId]);
  const audit = useApi((opts) => casesApi.audit(caseId, 500, opts), [caseId]);

  const entries = audit.data ? audit.data.items : NO_ENTRIES;

  const entityOptions = useMemo(() => {
    const present = new Set(entries.map((e) => e.entity_type));
    return Array.from(present).map((value) => ({
      value,
      label: ENTITY_LABEL[value] || value,
    }));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = days ? Date.now() - Number(days) * 86400000 : null;
    return entries.filter((entry) => {
      if (entityType && entry.entity_type !== entityType) return false;
      if (cutoff && new Date(entry.created_at).getTime() < cutoff) return false;
      if (!q) return true;
      const haystack = `${entry.action} ${entry.user_name || ''} ${entry.detail || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, search, entityType, days]);

  const hasFilters = Boolean(search || entityType || days);

  const columns = [
    { key: 'action', header: 'Activity', sortable: true },
    {
      key: 'entity_type',
      header: 'Event type',
      width: '130px',
      sortable: true,
      render: (row) => ENTITY_LABEL[row.entity_type] || row.entity_type,
    },
    {
      key: 'user_name',
      header: 'Performed by',
      width: '160px',
      sortable: true,
      render: (row) => row.user_name || 'System',
    },
    {
      key: 'created_at',
      header: 'Date & time',
      width: '170px',
      align: 'num',
      sortable: true,
      render: (row) => fmt.dateTime(row.created_at),
    },
  ];

  const c = detail.data;

  return (
    <>
      <PageHeader
        back={{ to: c ? `/cases/${c.id}` : '/cases', label: c ? c.case_number : 'Case' }}
        eyebrow={['Case management', c?.district_name || 'National']}
        title="Audit Trail"
        subtitle="View a chronological log of all significant activity and updates on this case."
      />

      <FilterBar>
        <FilterBar.Search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search activity, user or details…"
        />
        <FilterBar.Select
          label="Event type"
          value={entityType}
          placeholder="All event types"
          options={entityOptions}
          onChange={(event) => setEntityType(event.target.value)}
        />
        <FilterBar.Select
          label="Date range"
          value={days}
          placeholder="All time"
          options={DATE_RANGES}
          onChange={(event) => setDays(event.target.value)}
        />
        <FilterBar.Actions
          hasFilters={hasFilters}
          filterCount={[entityType, days, search].filter(Boolean).length}
          onClear={() => {
            setSearch('');
            setEntityType('');
            setDays('');
          }}
        />
      </FilterBar>

      <div className="audit-trail">
        <div className="audit-trail__main">
          {audit.loading && <Loading label="Loading the audit trail" rows={6} />}
          {audit.error && <ErrorState error={audit.error} onRetry={audit.reload} />}

          {audit.data && (
            <DataTable
              columns={columns}
              rows={filtered}
              getRowKey={(row) => row.id}
              caption={`${filtered.length} of ${entries.length} entries`}
              empty={
                <p className="audit-trail__empty">
                  {hasFilters
                    ? 'Nothing matches those filters.'
                    : 'No recorded activity on this case yet.'}
                </p>
              }
            />
          )}
        </div>

        <aside className="audit-trail__context">
          <p className="audit-trail__context-title">Case context</p>
          {detail.loading && <Loading inline rows={4} />}
          {detail.error && <ErrorState error={detail.error} onRetry={detail.reload} />}
          {c && (
            <dl>
              <div>
                <dt>Case ID</dt>
                <dd>{c.case_number}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{c.project_name}</dd>
              </div>
              <div>
                <dt>Village</dt>
                <dd>{c.village_name}</dd>
              </div>
              <div>
                <dt>Current stage</dt>
                <dd>{stageLabel(c.stage)}</dd>
              </div>
            </dl>
          )}
        </aside>
      </div>
    </>
  );
}
