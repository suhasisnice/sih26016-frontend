import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Download, FileEdit, Paperclip } from 'lucide-react';
import * as grievancesApi from '../api/grievances';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import * as fmt from '../lib/format';
import { grievanceCategoryLabel, grievanceStatusLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import RespondGrievanceModal from '../components/case/RespondGrievanceModal';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import '../pages/proposals.css';
import './objections.css';

const TERMINAL_STATUSES = ['resolved', 'closed'];

/* Unlike ObjectionDetail's synthetic three-node stepper (Objection only
   ever stores three real facts), a grievance genuinely has a status-change
   history — GrievanceStatusHistory, one row per real transition — so this
   draws the timeline straight from that, no invented steps. */
export default function GrievanceDetail() {
  const { grievanceId } = useParams();
  const { user } = useAuth();
  const [responding, setResponding] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const grievance = useApi((opts) => grievancesApi.get(grievanceId, opts), [grievanceId]);
  const g = grievance.data;

  if (grievance.loading) return <Loading label="Loading the grievance" rows={6} />;
  if (grievance.error) return <ErrorState error={grievance.error} onRetry={grievance.reload} />;
  if (!g) return null;

  const isTerminal = TERMINAL_STATUSES.includes(g.status);

  async function onDownloadAttachment() {
    setDownloading(true);
    try {
      await grievancesApi.downloadAttachment(g.id, g.attachment_filename);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={['Grievance management', g.case_number]}
        title="Grievance detail"
        subtitle={`${grievanceCategoryLabel(g.category)} — raised against ${g.case_number}`}
        actions={
          can.respondToGrievance(user) &&
          !isTerminal && (
            <Button variant="primary" onClick={() => setResponding(true)}>
              Update status
            </Button>
          )
        }
      />

      <dl className="objection-facts">
        <div>
          <dt>Grievance ID</dt>
          <dd>{g.grievance_number}</dd>
        </div>
        <div>
          <dt>Related case</dt>
          <dd>
            <Link to={`/cases/${g.case_id}`}>{g.case_number}</Link>
          </dd>
        </div>
        <div>
          <dt>Filed by</dt>
          <dd>{g.person_name}</dd>
        </div>
        <div>
          <dt>Filed on</dt>
          <dd>{fmt.date(g.filed_on)}</dd>
        </div>
        <div>
          <dt>Current status</dt>
          <dd>
            <StatusBadge kind="grievance" value={g.status} />
          </dd>
        </div>
      </dl>

      <div className="objection-summary">
        <p className="objection-summary__label">Subject</p>
        <p>{g.subject}</p>
      </div>
      <div className="objection-summary">
        <p className="objection-summary__label">Description</p>
        <p>{g.description}</p>
      </div>

      {g.has_attachment && (
        <div className="objection-summary">
          <p className="objection-summary__label">Supporting document</p>
          <Button variant="quiet" onClick={onDownloadAttachment} disabled={downloading}>
            <Paperclip size={14} strokeWidth={1.75} aria-hidden="true" style={{ marginRight: 6 }} />
            {downloading ? 'Downloading…' : g.attachment_filename}
            <Download size={14} strokeWidth={1.75} aria-hidden="true" style={{ marginLeft: 6 }} />
          </Button>
        </div>
      )}

      <h2 className="objection-section">Timeline</h2>
      <ol className="trail">
        {g.history.map((entry, index) => (
          <li
            key={`${entry.to_status}-${entry.changed_on}-${index}`}
            className={`trail__item${index === g.history.length - 1 ? ' is-current' : ''}`}
          >
            <div className="trail__head">
              <StatusBadge kind="grievance" value={entry.to_status} />
              <span className="trail__actor">
                {entry.changed_by_name ? `By ${entry.changed_by_name}` : grievanceStatusLabel(entry.to_status)}
              </span>
              <span className="trail__date">{fmt.date(entry.changed_on)}</span>
            </div>
            {entry.note && <p className="trail__note">{entry.note}</p>}
          </li>
        ))}
        {!isTerminal && (
          <li className="objection-trail__waiting">
            <div className="trail__head">
              <FileEdit size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="trail__actor">
                {g.status === 'info_required'
                  ? 'Waiting on additional information from the filer'
                  : 'Awaiting the next update'}
              </span>
            </div>
          </li>
        )}
        {isTerminal && (
          <li className="trail__item">
            <div className="trail__head">
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
              <span className="trail__actor">{grievanceStatusLabel(g.status)}</span>
            </div>
          </li>
        )}
      </ol>

      {responding && (
        <RespondGrievanceModal
          grievance={g}
          onClose={() => setResponding(false)}
          onDone={() => {
            setResponding(false);
            grievance.reload();
          }}
        />
      )}
    </>
  );
}
