import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as objectionsApi from '../api/objections';
import { useApi } from '../hooks/useApi';
import { useEnums } from '../hooks/useEnums';
import { useAuth } from '../auth/AuthContext';
import { isLandowner } from '../auth/permissions';
import * as fmt from '../lib/format';
import { objectionStatusLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/case/StatusBadge';
import FilterBar from '../components/ui/FilterBar';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import './caselist.css';

/* Every objection across the caseload, for officers, and their own for a
   landowner — the backend scopes it either way.

   An objection unanswered past twenty-one days is overdue under the response
   window the rules engine enforces, and those rows carry the same 3px mark
   the case list uses for a drifting case.

   Recording a response now happens on ObjectionDetail, not inline here —
   the Figma "Objection Detail" frame puts "Update status" as a page action
   next to the stepper and activity log, not as a row-level link, and that
   is the more honest place for a decision this consequential. */
export default function Objections() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { objection_statuses: statuses } = useEnums();

  const [status, setStatus] = useState('');
  const [overdueOnly, setOverdueOnly] = useState('');

  const objections = useApi(
    (opts) =>
      objectionsApi.list(
        {
          objection_status: status || undefined,
          overdue_only: overdueOnly === 'true' ? true : undefined,
        },
        opts,
      ),
    [status, overdueOnly],
  );

  const hasFilters = Boolean(status || overdueOnly);

  const columns = [
    {
      key: 'case_number',
      header: 'Case',
      width: '150px',
      sortable: true,
      render: (row) => <span className="case-number">{row.case_number}</span>,
    },
    { key: 'person_name', header: 'Filed by', width: '180px', sortable: true },
    {
      key: 'grounds',
      header: 'Grounds',
      render: (row) => (
        <span className="case-cell">
          <span>{row.grounds}</span>
          {row.response && (
            <span className="case-cell__meta">
              Answered {fmt.date(row.responded_on)}: {row.response}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'filed_on',
      header: 'Filed',
      width: '104px',
      sortable: true,
      render: (row) => fmt.date(row.filed_on),
    },
    {
      key: 'days_open',
      header: 'Open',
      width: '96px',
      align: 'num',
      sortable: true,
      render: (row) =>
        row.days_open === null || row.days_open === undefined ? (
          <span style={{ color: 'var(--text-faint)' }}>—</span>
        ) : (
          <span className={row.is_overdue ? 'is-overdue' : undefined}>
            {fmt.days(row.days_open)}
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '128px',
      sortable: true,
      render: (row) => <StatusBadge kind="objection" value={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={['Objection management', user?.district_name || 'National']}
        title={isLandowner(user) ? 'Your objections' : 'Objections'}
        subtitle={
          isLandowner(user)
            ? 'Objections you have filed, and what the office has said in reply.'
            : 'Filed under Section 15. The Act expects a hearing and a reasoned response, and an objection left unanswered blocks the declaration.'
        }
      />

      <FilterBar>
        <FilterBar.Select
          label="Status"
          value={status}
          placeholder="All statuses"
          options={statuses.map((value) => ({ value, label: objectionStatusLabel(value) }))}
          onChange={(event) => setStatus(event.target.value)}
        />
        <FilterBar.Select
          label="Response window"
          value={overdueOnly}
          placeholder="All objections"
          options={[{ value: 'true', label: 'Overdue only' }]}
          onChange={(event) => setOverdueOnly(event.target.value)}
        />
        <FilterBar.Actions
          hasFilters={hasFilters}
          filterCount={[status, overdueOnly].filter(Boolean).length}
          onClear={() => {
            setStatus('');
            setOverdueOnly('');
          }}
        />
      </FilterBar>

      {objections.loading && <Loading label="Loading objections" rows={6} />}
      {objections.error && <ErrorState error={objections.error} onRetry={objections.reload} />}

      {objections.data && (
        <>
          {objections.data.total > 0 && (
            <p className="alert-summary" style={{ marginBottom: 'var(--s3)' }}>
              <span>
                <b>{objections.data.open_count}</b> open
              </span>
              {objections.data.overdue_count > 0 && (
                <span className="is-overdue">
                  <b>{objections.data.overdue_count}</b> past the response window
                </span>
              )}
            </p>
          )}

          <DataTable
            columns={columns}
            rows={objections.data.items}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(`/objections/${row.id}`)}
            isRowFlagged={(row) => row.is_overdue}
            caption={
              objections.data.items.length
                ? 'A red rule marks an objection past its response window. Select a row to open it.'
                : undefined
            }
            empty={
              <Empty
                center
                title={status || overdueOnly ? 'Nothing matches those filters' : 'No objections filed'}
                body={
                  isLandowner(user)
                    ? 'You have not filed an objection. During the objection period the district office accepts them in writing.'
                    : 'No objection is outstanding in your jurisdiction.'
                }
              />
            }
          />
        </>
      )}
    </>
  );
}
