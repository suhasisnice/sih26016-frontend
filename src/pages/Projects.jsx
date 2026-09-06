import { useNavigate } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import { useApi } from '../hooks/useApi';
import { stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import DataTable from '../components/ui/DataTable';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';

/* One row per project, each carrying its own live rollup — required vs
   affected area, overall progress, who last moved a case in it, how many
   open findings it has, and how its worst case is tracking against
   deadline. A project itself has no status of its own (see
   ProjectWorkspaceOut's docstring on the backend); everything here is
   computed from the cases under it, same as every other aggregate in this
   product. */
export default function Projects() {
  const navigate = useNavigate();
  const projects = useApi((opts) => projectsApi.list({}, opts), []);

  return (
    <>
      <PageHeader title="Projects" subtitle="Every acquisition project in scope, and how it stands." />

      {projects.loading && <Loading label="Loading projects" rows={6} />}
      {projects.error && <ErrorState error={projects.error} onRetry={projects.reload} />}

      {projects.data && (
        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Project',
              render: (row) => (
                <span>
                  {row.name}
                  <br />
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{row.requiring_body}</span>
                </span>
              ),
            },
            { key: 'district_name', header: 'District', width: '140px' },
            {
              key: 'case_count',
              header: 'Cases',
              width: '80px',
              align: 'num',
            },
            {
              key: 'current_stage',
              header: 'Current stage',
              width: '160px',
              render: (row) => (
                <span style={{ color: 'var(--text-muted)' }}>
                  {row.current_stage ? stageLabel(row.current_stage) : 'Multiple stages'}
                </span>
              ),
            },
            {
              key: 'overall_progress_pct',
              header: 'Progress',
              width: '160px',
              render: (row) => (
                <span>
                  {row.overall_progress_pct == null ? (
                    <span style={{ color: 'var(--text-faint)' }}>No parcels yet</span>
                  ) : (
                    <>
                      {row.overall_progress_pct}%
                      <br />
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                        {row.affected_area_ha.toFixed(2)} of {row.required_area_ha.toFixed(2)} ha
                      </span>
                    </>
                  )}
                </span>
              ),
            },
            {
              key: 'responsible_officer_name',
              header: 'Officer',
              width: '150px',
              render: (row) =>
                row.responsible_officer_name || <span style={{ color: 'var(--text-faint)' }}>Unassigned</span>,
            },
            {
              key: 'pending_action_count',
              header: 'Pending actions',
              width: '110px',
              align: 'num',
            },
            {
              key: 'deadline_status',
              header: 'Deadline',
              width: '110px',
              render: (row) => <StatusBadge kind="timeline" value={row.deadline_status} />,
            },
          ]}
          rows={projects.data.items}
          getRowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/projects/${row.id}`)}
          isRowFlagged={(row) => row.deadline_status === 'breached'}
          caption={projects.data.items.length ? 'Select a project to open its workspace.' : undefined}
          empty={<Empty center title="No projects in scope" body="No project has a case visible to your account yet." />}
        />
      )}
    </>
  );
}
