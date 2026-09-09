import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as fmt from '../../lib/format';
import { stageLabel } from '../../lib/labels';
import StatusBadge from '../case/StatusBadge';
import DataTable from '../ui/DataTable';
import Loading from '../states/Loading';
import ErrorState from '../states/ErrorState';
import Empty from '../states/Empty';
import FilterBar from '../ui/FilterBar';

/* "Cases Requiring Attention" — one row per case with an open finding from
   the rules engine, worst first. Distinct from the flat alerts panel
   elsewhere on the dashboard: that one is a list of findings, this one is
   a list of cases to act on, each carrying enough context (project,
   village, survey numbers, who last touched it, the deadline) that a
   Collector can decide what to do without opening every one first. */
export default function AttentionPanel({ state }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  if (state.loading) return <Loading label="Loading cases requiring attention" rows={5} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;

  const { items } = state.data;

  // Client-side, not a server round trip: this panel's whole result set
  // (capped at 20 by Dashboard.jsx's own query) is already in memory, so
  // filtering it here is instant and needs no new backend endpoint. Matches
  // whatever's actually visible in the table — case number, survey number,
  // village/project, and who it's assigned to — so a search that finds a
  // row also explains why that row matched.
  const needle = query.trim().toLowerCase();
  const visibleItems = needle
    ? items.filter((row) =>
        [
          row.case_number,
          row.project_name,
          row.village_name,
          row.responsible_officer_name,
          row.reason,
          ...(row.survey_numbers || []),
        ]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(needle)),
      )
    : items;

  const columns = [
    {
      key: 'case_number',
      header: 'Case',
      width: '150px',
      render: (row) => (
        <span>
          <span className="case-number">{row.case_number}</span>
          <br />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{row.project_name}</span>
        </span>
      ),
    },
    {
      key: 'village_name',
      header: 'Village',
      width: '140px',
      render: (row) => (
        <span>
          {row.village_name}
          <br />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {row.survey_numbers.slice(0, 2).join(', ')}
            {row.survey_numbers.length > 2 ? ` +${row.survey_numbers.length - 2}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      width: '160px',
      render: (row) => <span style={{ color: 'var(--text-muted)' }}>{stageLabel(row.stage)}</span>,
    },
    {
      key: 'responsible_officer_name',
      header: 'Officer',
      width: '130px',
      render: (row) => row.responsible_officer_name || <span style={{ color: 'var(--text-faint)' }}>Unassigned</span>,
    },
    {
      key: 'reason',
      header: 'Why it needs attention',
      render: (row) => (
        <span>
          {row.reason}
          {row.open_alert_count > 1 && (
            <span style={{ color: 'var(--text-faint)' }}> (+{row.open_alert_count - 1} more)</span>
          )}
        </span>
      ),
    },
    {
      key: 'days_remaining',
      header: 'Deadline',
      width: '130px',
      align: 'num',
      render: (row) =>
        row.stage_due_on ? (
          <span>
            {fmt.date(row.stage_due_on)}
            <br />
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {row.days_remaining < 0
                ? `${Math.abs(row.days_remaining)} days overdue`
                : `${row.days_remaining} days left`}
            </span>
          </span>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>No deadline on file</span>
        ),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: '100px',
      render: (row) => <StatusBadge kind="severity" value={row.priority} />,
    },
  ];

  return (
    <>
      {items.length > 0 && (
        <FilterBar>
          <FilterBar.Search
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by case number, survey number, village, project or officer…"
          />
        </FilterBar>
      )}
      <DataTable
        columns={columns}
        rows={visibleItems}
        getRowKey={(row) => row.case_id}
        onRowClick={(row) => navigate(`/cases/${row.case_id}`)}
        isRowFlagged={(row) => row.timeline_status === 'breached'}
        caption={
          visibleItems.length
            ? 'Ranked by severity, then by how soon the deadline is. Select a row to open the case.'
            : undefined
        }
        empty={
          needle ? (
            <Empty center title="No matches" body={`Nothing requiring attention matches "${query.trim()}".`} />
          ) : (
            <Empty center title="Nothing needs attention" body="No case in scope has an open finding right now." />
          )
        }
      />
    </>
  );
}
