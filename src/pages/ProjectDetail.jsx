import { useParams, useNavigate } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import { useApi } from '../hooks/useApi';
import { stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import ProvenanceBadge from '../components/case/ProvenanceBadge';
import KpiTile from '../components/dashboard/KpiTile';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';

/* The Project Workspace — the rollup itself, plus a way into the full case
   list already filtered to this project. Deliberately not a second copy
   of everything CaseDetail already shows per case (timeline, documents,
   objections, compensation): that page is a complete workspace on its
   own, and a project is a collection of those, not a bigger version of
   one. */
export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = useApi((opts) => projectsApi.get(projectId, opts), [projectId]);

  if (project.loading) return <Loading label="Loading the project" rows={4} />;
  if (project.error) return <ErrorState error={project.error} onRetry={project.reload} />;
  if (!project.data) return null;

  const p = project.data;

  return (
    <>
      <PageHeader
        back={{ to: '/projects', label: 'All projects' }}
        title={p.name}
        subtitle={
          <>
            {p.requiring_body} · {p.district_name} <ProvenanceBadge provenance={p.provenance} />
          </>
        }
        actions={
          <Button variant="primary" onClick={() => navigate(`/cases?project_id=${p.id}`)}>
            View {p.case_count} {p.case_count === 1 ? 'case' : 'cases'}
          </Button>
        }
      />

      <div className="kpis">
        <KpiTile
          label="Area affected"
          value={p.affected_area_ha.toFixed(2)}
          unit="ha"
          of={`of ${p.required_area_ha.toFixed(2)} ha required`}
          meter={p.overall_progress_pct}
        />
        <KpiTile
          label="Current stage"
          value={p.current_stage ? stageLabel(p.current_stage) : 'Multiple'}
        />
        <KpiTile label="Pending actions" value={String(p.pending_action_count)} />
        <KpiTile
          label="Responsible officer"
          value={p.responsible_officer_name || 'Unassigned'}
        />
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Deadline status</h2>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          The worst-tracking case in this project is currently{' '}
          <StatusBadge kind="timeline" value={p.deadline_status} />. Open the case list to see
          which one and act on it.
        </p>
      </section>
    </>
  );
}
