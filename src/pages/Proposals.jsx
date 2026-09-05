import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as proposalsApi from '../api/proposals';
import * as referenceApi from '../api/reference';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can, isOversight } from '../auth/permissions';
import * as fmt from '../lib/format';
import { proposalStatusLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import './proposals.css';

/* The approval pipeline: every proposal, and which office is holding it.

   Ordered oldest-first by status change, because this is a work queue, not a
   feed — the file that has been waiting longest belongs at the top. A
   proposal sitting untouched for six weeks is the failure this screen exists
   to make visible, and a newest-first list would bury it. */

/* The chain in order, so the strip reads left to right as a pipeline rather
   than as an alphabetical set of chips. Terminal states sit at the end. */
const PIPELINE = [
  'draft',
  'submitted',
  'under_scrutiny',
  'returned',
  'approved',
  'rejected',
  'withdrawn',
];

export default function Proposals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [stateId, setStateId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const states = useApi((opts) => referenceApi.states(opts), [], {
    // Only an account that reads across states has anything to choose.
    skip: !isOversight(user) && user?.role !== 'admin',
  });

  const proposals = useApi(
    (opts) =>
      proposalsApi.list(
        {
          proposal_status: status || undefined,
          state_id: stateId || undefined,
          search: query || undefined,
          limit: 100,
        },
        opts,
      ),
    [status, stateId, query],
  );

  const byStatus = proposals.data?.by_status || {};
  /* Summing seven small integers, so no useMemo: memoising it would need a
     stable `byStatus`, and building one costs more than the addition. */
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

  const columns = [
    {
      key: 'proposal_number',
      header: 'Proposal',
      width: '170px',
      sortable: true,
      render: (row) => <span className="proposals__number">{row.proposal_number}</span>,
    },
    {
      key: 'title',
      header: 'Purpose',
      render: (row) => (
        <div>
          <div className="proposals__title">{row.title}</div>
          <div className="proposals__body">{row.requiring_body}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      sortable: true,
      sortValue: (row) => PIPELINE.indexOf(row.status),
      render: (row) => <StatusBadge kind="proposal" value={row.status} />,
    },
    {
      key: 'held_by',
      header: 'With',
      width: '190px',
      render: (row) => <span className="proposals__held">{row.held_by}</span>,
    },
    {
      key: 'district_name',
      header: 'District',
      width: '140px',
      sortable: true,
      render: (row) => (
        <div>
          <div>{row.district_name}</div>
          <div className="proposals__body">{row.village_name}</div>
        </div>
      ),
    },
    {
      key: 'estimated_area_ha',
      header: 'Est. area',
      width: '100px',
      align: 'num',
      sortable: true,
      render: (row) => fmt.hectares(row.estimated_area_ha),
    },
    {
      key: 'days_in_status',
      header: 'Waiting',
      width: '110px',
      align: 'num',
      sortable: true,
      /* Highlighted past three weeks. A proposal is not "late" in any
         statutory sense — there is no clock on scrutiny — but three weeks
         with no movement is the thing a reviewer wants their eye drawn to. */
      render: (row) => (
        <span className={row.days_in_status > 21 ? 'proposals__waiting is-long' : 'proposals__waiting'}>
          {fmt.days(row.days_in_status)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Land requirement proposals, from submission through scrutiny to sanction."
        actions={
          can.createProposal(user) && (
            <Button onClick={() => navigate('/proposals/new')}>New proposal</Button>
          )
        }
      />

      {/* The pipeline strip. Counts come from the API aggregated over the
          user's whole scope, not from the page that happens to be loaded,
          so selecting a status does not zero out the chips beside it. */}
      <div className="pipeline" role="group" aria-label="Filter by status">
        <button
          type="button"
          className={`pipeline__chip${status === '' ? ' is-active' : ''}`}
          onClick={() => setStatus('')}
        >
          <span className="pipeline__count">{fmt.count(total)}</span>
          <span className="pipeline__label">All</span>
        </button>
        {PIPELINE.map((value) => (
          <button
            key={value}
            type="button"
            className={`pipeline__chip${status === value ? ' is-active' : ''} is-${value}`}
            onClick={() => setStatus(status === value ? '' : value)}
            aria-pressed={status === value}
          >
            <span className="pipeline__count">{fmt.count(byStatus[value] || 0)}</span>
            <span className="pipeline__label">{proposalStatusLabel(value)}</span>
          </button>
        ))}
      </div>

      <div className="proposals__filters">
        <form
          className="proposals__search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Proposal number or title"
            aria-label="Search proposals"
          />
          <Button type="submit" variant="quiet" size="sm">
            Search
          </Button>
        </form>

        {states.data && states.data.length > 1 && (
          <Select
            label="State"
            value={stateId}
            onChange={(e) => setStateId(e.target.value)}
            options={[
              { value: '', label: 'All states' },
              ...states.data.map((s) => ({ value: String(s.id), label: s.name })),
            ]}
          />
        )}
      </div>

      {proposals.loading && <Loading label="Loading proposals" rows={6} />}
      {proposals.error && <ErrorState error={proposals.error} onRetry={proposals.reload} />}

      {proposals.data && proposals.data.items.length === 0 && (
        <Empty
          title="No proposals here"
          body={
            status
              ? `Nothing is currently ${proposalStatusLabel(status).toLowerCase()}.`
              : 'No proposals have been filed within your scope yet.'
          }
        />
      )}

      {proposals.data && proposals.data.items.length > 0 && (
        <DataTable
          columns={columns}
          rows={proposals.data.items}
          getRowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/proposals/${row.id}`)}
          caption={`${proposals.data.total} proposals`}
        />
      )}

      <p className="proposals__foot">
        A proposal is opened by the requiring body, scrutinised by the state,
        and sanctioned centrally. Only on sanction does an acquisition case
        come into existence — see{' '}
        <Link to="/cases">Cases</Link> for those already under way.
      </p>
    </>
  );
}
