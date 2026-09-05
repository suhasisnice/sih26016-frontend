import { useNavigate } from 'react-router-dom';
import * as fmt from '../../lib/format';
import { riskBandLabel, stageLabel } from '../../lib/labels';
import StatusBadge from '../case/StatusBadge';
import DataTable from '../ui/DataTable';
import Loading from '../states/Loading';
import ErrorState from '../states/ErrorState';
import Empty from '../states/Empty';

/* The predictive half of the dashboard: which cases are likely to slip, and
   why. Every row carries `evidence` from the API — the signal behind the
   score — because a score with no explanation is not usable in a process
   where a decision has to be justified. */
const BANDS = ['severe', 'elevated', 'moderate', 'low'];

export default function ForecastPanel({ state }) {
  const navigate = useNavigate();

  if (state.loading) return <Loading label="Loading the forecast" rows={5} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;

  const { items, summary } = state.data;

  const columns = [
    {
      key: 'case_number',
      header: 'Case',
      width: '150px',
      render: (row) => <span className="case-number">{row.case_number}</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      width: '170px',
      render: (row) => <span style={{ color: 'var(--text-muted)' }}>{stageLabel(row.stage)}</span>,
    },
    {
      key: 'risk_band',
      header: 'Risk',
      width: '110px',
      render: (row) => <StatusBadge kind="risk" value={row.risk_band} />,
    },
    {
      key: 'primary_driver',
      header: 'Primary driver',
      render: (row) => row.primary_driver,
    },
    {
      key: 'projected_completion',
      header: 'Projected',
      width: '150px',
      align: 'num',
      render: (row) => (
        <span>
          {fmt.date(row.projected_completion)}
          <br />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {fmt.days(row.projected_days_remaining)} left
          </span>
        </span>
      ),
    },
  ];

  return (
    <>
      {summary && (
        <p className="alert-summary" style={{ marginBottom: 'var(--s3)' }}>
          {BANDS.filter((band) => summary[band] > 0).map((band) => (
            <span key={band}>
              <b>{summary[band]}</b> {riskBandLabel(band).toLowerCase()}
            </span>
          ))}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(row) => row.case_id}
        onRowClick={(row) => navigate(`/cases/${row.case_id}`)}
        isRowFlagged={(row) => row.risk_band === 'severe'}
        caption={
          items.length
            ? 'Projected from this office’s own completed stage transitions. Select a row to open the case.'
            : undefined
        }
        empty={
          <Empty
            center
            title="Nothing to forecast"
            body="No case in scope has enough history yet to project against."
          />
        }
      />
    </>
  );
}
