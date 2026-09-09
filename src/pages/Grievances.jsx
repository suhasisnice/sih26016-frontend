import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as grievancesApi from '../api/grievances';
import { useApi } from '../hooks/useApi';
import { useEnums } from '../hooks/useEnums';
import { useAuth } from '../auth/AuthContext';
import { isLandowner } from '../auth/permissions';
import * as fmt from '../lib/format';
import { grievanceCategoryLabel, grievanceStatusLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/case/StatusBadge';
import FilterBar from '../components/ui/FilterBar';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import './caselist.css';

/* Every grievance across the caseload, for officers, and their own for a
   landowner — the backend scopes it either way (GET /grievances runs
   through the same scope_cases_to_user every case-related list uses).

   Deliberately its own page and its own route, not folded into
   Objections.jsx: a grievance is not an objection (see the backend's
   Grievance model docstring), and giving it a separate list keeps that
   distinction visible rather than papering over it with a filter. */
export default function Grievances() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { grievance_categories: categories, grievance_statuses: statuses } = useEnums();

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const grievances = useApi(
    (opts) =>
      grievancesApi.list(
        { grievance_status: status || undefined },
        opts,
      ),
    [status],
  );

  const hasFilters = Boolean(category || status);
  const items = grievances.data ? grievances.data.items : [];
  const visibleItems = category ? items.filter((g) => g.category === category) : items;

  const columns = [
    {
      key: 'grievance_number',
      header: 'Grievance',
      width: '150px',
      render: (row) => <span className="case-number">{row.grievance_number}</span>,
    },
    { key: 'case_number', header: 'Case', width: '150px' },
    {
      key: 'category',
      header: 'Type',
      width: '180px',
      render: (row) => grievanceCategoryLabel(row.category),
    },
    { key: 'subject', header: 'Subject' },
    {
      key: 'filed_on',
      header: 'Filed',
      width: '104px',
      render: (row) => fmt.date(row.filed_on),
    },
    {
      key: 'status',
      header: 'Status',
      width: '160px',
      render: (row) => <StatusBadge kind="grievance" value={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={['Grievance management', user?.district_name || 'National']}
        title={isLandowner(user) ? 'Your grievances' : 'Grievances'}
        subtitle={
          isLandowner(user)
            ? 'Complaints you have raised about your own case, and what the office has said in reply.'
            : 'Service complaints raised against a case — compensation, documents, surveys, delay, or anything else that is not the formal Section 15 objection.'
        }
        actions={
          isLandowner(user) && (
            <Button variant="primary" onClick={() => navigate('/grievances/new')}>
              Raise grievance
            </Button>
          )
        }
      />

      <FilterBar>
        <FilterBar.Select
          label="Type"
          value={category}
          placeholder="All types"
          options={categories.map((value) => ({ value, label: grievanceCategoryLabel(value) }))}
          onChange={(event) => setCategory(event.target.value)}
        />
        <FilterBar.Select
          label="Status"
          value={status}
          placeholder="All statuses"
          options={statuses.map((value) => ({ value, label: grievanceStatusLabel(value) }))}
          onChange={(event) => setStatus(event.target.value)}
        />
        <FilterBar.Actions
          hasFilters={hasFilters}
          filterCount={[category, status].filter(Boolean).length}
          onClear={() => {
            setCategory('');
            setStatus('');
          }}
        />
      </FilterBar>

      {grievances.loading && <Loading label="Loading grievances" rows={6} />}
      {grievances.error && <ErrorState error={grievances.error} onRetry={grievances.reload} />}

      {grievances.data && (
        <>
          {grievances.data.open_count > 0 && (
            <p className="alert-summary" style={{ marginBottom: 'var(--s3)' }}>
              <span>
                <b>{grievances.data.open_count}</b> open
              </span>
            </p>
          )}

          <DataTable
            columns={columns}
            rows={visibleItems}
            getRowKey={(row) => row.id}
            onRowClick={(row) => navigate(`/grievances/${row.id}`)}
            caption={visibleItems.length ? 'Select a row to open it.' : undefined}
            empty={
              hasFilters ? (
                <Empty center title="Nothing matches those filters" body="Try a different filter, or clear them." />
              ) : (
                <Empty
                  center
                  title="No grievances"
                  body={
                    isLandowner(user)
                      ? 'You have not submitted any grievances.'
                      : 'No grievance is outstanding in your jurisdiction.'
                  }
                />
              )
            }
          />
        </>
      )}
    </>
  );
}
