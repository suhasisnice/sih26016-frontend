import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import * as surveyApi from '../api/survey';
import { api } from '../api/client';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import * as fmt from '../lib/format';
import {
  boundaryConditionLabel,
  landUseTypeLabel,
  physicalFeatureLabel,
  surveyPhotoCategoryLabel,
} from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import SurveyWizard from '../components/survey/SurveyWizard';
import Button from '../components/ui/Button';
import { Textarea } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import '../components/case/case.css';
import './fieldwork.css';
import './survey.css';

const MIN_BOUNDARY_CORNERS = 3;

/* The route shell: Start Survey → the mobile wizard (SurveyWizard) →
   Approve/Return for a reviewer. See app/routers/survey.py for the
   lifecycle this mirrors. */
export default function SurveyTaskDetail() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const task = useApi((opts) => surveyApi.get(taskId, opts), [taskId]);

  const start = useMutation(() => surveyApi.start(taskId));
  const [startError, setStartError] = useState(null);

  async function onStart() {
    setStartError(null);
    try {
      await start.run();
      task.reload();
    } catch (err) {
      setStartError(err);
    }
  }

  // Only the very first load shows the full-page spinner. Every later
  // reload (after a save, a photo upload, submit...) leaves task.data set
  // while it refetches — guarding on task.loading alone would swap the
  // whole tree for a spinner on every single autosave, unmounting
  // SurveyWizard and wiping all of its in-progress local state (which
  // step the officer is on, anything not yet round-tripped to the server)
  // each time.
  if (task.loading && !task.data) return <Loading label="Loading the survey" rows={5} />;
  if (task.error) return <ErrorState error={task.error} onRetry={task.reload} />;
  if (!task.data) return null;

  const t = task.data;
  const isAssignee = user && user.id === t.assigned_to_user_id;
  const isReviewer = can.reviewSurvey(user) && !isAssignee;

  return (
    <>
      <PageHeader
        back={{ to: '/survey-tasks', label: 'My Surveys' }}
        title={t.village_name}
        subtitle={
          <>
            {t.case_number} · {t.project_name}
            {t.parcel_survey_number ? ` · Survey ${t.parcel_survey_number}` : ''}
          </>
        }
        actions={<StatusBadge kind="surveyTask" value={t.status} />}
      />

      {t.status === 'returned' && t.review_note && (
        <div className="survey-callout survey-callout--returned">
          <strong>Sent back for correction</strong>
          <p>{t.review_note}</p>
        </div>
      )}
      {t.status === 'approved' && (
        <div className="survey-callout survey-callout--approved">
          <strong>Approved</strong>
          {t.review_note && <p>{t.review_note}</p>}
        </div>
      )}

      {t.notes && (
        <div className="survey-callout">
          <strong>Assignment notes</strong>
          <p>{t.notes}</p>
        </div>
      )}

      {isAssignee && t.status === 'assigned' && (
        <section className="panel">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--s4)' }}>
            {t.assigned_by_name ? `Assigned by ${t.assigned_by_name}. ` : ''}
            Starting records the time and opens the entry form.
          </p>
          {startError && <ErrorState error={startError} title="Could not start the survey" />}
          <Button variant="primary" block onClick={onStart} disabled={start.pending}>
            {start.pending ? 'Starting…' : 'Start survey'}
          </Button>
        </section>
      )}

      {isAssignee && (t.status === 'in_progress' || t.status === 'returned') && (
        <SurveyWizard task={t} onChanged={task.reload} />
      )}

      {isAssignee && (t.status === 'submitted' || t.status === 'approved') && (
        <SurveySummary task={t} />
      )}

      {isReviewer && <SurveySummary task={t} />}
      {isReviewer && t.status === 'submitted' && <ReviewActions task={t} onChanged={task.reload} />}
    </>
  );
}

/* Read-only — what a reviewer sees, and what the assignee sees once their
   own submission is out of their hands. */
function SurveySummary({ task: t }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">What was recorded</h2>
      </div>
      <div className="facts">
        <div>
          <p className="fact__label">MEASURED AREA</p>
          <p className="fact__value">
            {t.measured_area_ha != null ? `${fmt.hectaresPlain(t.measured_area_ha)} ha` : (
              <span style={{ color: 'var(--text-faint)' }}>Not recorded</span>
            )}
          </p>
        </div>
        <div>
          <p className="fact__label">BOUNDARY</p>
          <p className="fact__value">
            {t.boundary_point_count >= MIN_BOUNDARY_CORNERS
              ? `${t.boundary_point_count} corners walked`
              : <span style={{ color: 'var(--text-faint)' }}>Not walked</span>}
          </p>
        </div>
        <div>
          <p className="fact__label">LOCATION</p>
          <p className="fact__value">
            {t.has_location ? 'Recorded' : <span style={{ color: 'var(--text-faint)' }}>Not recorded</span>}
          </p>
        </div>
        <div>
          <p className="fact__label">SUBMITTED</p>
          <p className="fact__value">{t.submitted_at ? fmt.dateTime(t.submitted_at) : '—'}</p>
        </div>
        {t.land_use && (
          <div>
            <p className="fact__label">LAND USE</p>
            <p className="fact__value">{landUseTypeLabel(t.land_use)}</p>
          </div>
        )}
        {t.boundary_condition && (
          <div>
            <p className="fact__label">BOUNDARY CONDITION</p>
            <p className="fact__value">{boundaryConditionLabel(t.boundary_condition)}</p>
          </div>
        )}
      </div>

      {(t.on_site_person_name || t.person_verified) && (
        <>
          <p className="fact__label" style={{ marginTop: 'var(--s4)' }}>PERSON ON SITE</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            {t.person_verified
              ? 'Recorded owner confirmed present on site.'
              : `${t.on_site_person_name}${t.on_site_person_relation ? ` (${t.on_site_person_relation})` : ''}`}
            {t.person_verification_note && ` — ${t.person_verification_note}`}
          </p>
        </>
      )}

      {t.physical_features && t.physical_features.length > 0 && (
        <>
          <p className="fact__label" style={{ marginTop: 'var(--s4)' }}>PHYSICAL FEATURES</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            {t.physical_features.map(physicalFeatureLabel).join(', ')}
          </p>
        </>
      )}

      {t.remarks && (
        <>
          <p className="fact__label" style={{ marginTop: 'var(--s4)' }}>OFFICER OBSERVATIONS</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{t.remarks}</p>
        </>
      )}

      {t.photos.length > 0 && (
        <>
          <p className="fact__label" style={{ marginTop: 'var(--s4)', marginBottom: 'var(--s2)' }}>
            PHOTOS ({t.photos.length})
          </p>
          <div className="survey-photos">
            {t.photos.map((photo) => (
              <PhotoThumbnail key={photo.id} taskId={t.id} photo={photo} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ReviewActions({ task: t, onChanged }) {
  const [mode, setMode] = useState(null); // null | 'return'
  const [reason, setReason] = useState('');
  const approve = useMutation((note) => surveyApi.approve(t.id, note));
  const returnTask = useMutation((note) => surveyApi.returnForCorrection(t.id, note));

  async function onApprove() {
    try {
      await approve.run(null);
      onChanged();
    } catch {
      /* approve.error renders below */
    }
  }

  async function onReturn() {
    try {
      await returnTask.run(reason.trim());
      onChanged();
    } catch {
      /* returnTask.error renders below */
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Review</h2>
      </div>
      {approve.error && <ErrorState error={approve.error} title="Could not approve" />}
      {returnTask.error && <ErrorState error={returnTask.error} title="Could not return" />}

      {mode !== 'return' ? (
        <span style={{ display: 'flex', gap: 'var(--s3)' }}>
          <Button variant="primary" onClick={onApprove} disabled={approve.pending}>
            {approve.pending ? 'Approving…' : 'Approve'}
          </Button>
          <Button variant="quiet" onClick={() => setMode('return')} disabled={approve.pending}>
            Return for correction
          </Button>
        </span>
      ) : (
        <>
          <Textarea
            label="Reason (required)"
            value={reason}
            maxLength={500}
            placeholder="What needs to be recaptured or corrected."
            onChange={(event) => setReason(event.target.value)}
          />
          <span style={{ display: 'flex', gap: 'var(--s3)' }}>
            <Button variant="quiet" onClick={() => setMode(null)} disabled={returnTask.pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onReturn}
              disabled={returnTask.pending || reason.trim().length < 3}
            >
              {returnTask.pending ? 'Sending…' : 'Send back'}
            </Button>
          </span>
        </>
      )}
    </section>
  );
}

function PhotoThumbnail({ taskId, photo, onRemove }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    (async () => {
      try {
        const res = await api.raw(`/survey-tasks/${taskId}/photos/${photo.id}`);
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        /* thumbnail just stays blank */
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, photo.id]);

  return (
    <div className="survey-photo">
      {src ? <img src={src} alt={photo.caption || 'Survey photo'} /> : <div className="survey-photo__placeholder" />}
      {(photo.category || photo.caption) && (
        <span className="survey-photo__caption">
          {photo.category ? surveyPhotoCategoryLabel(photo.category) : photo.caption}
        </span>
      )}
      {onRemove && (
        <button type="button" className="survey-photo__remove" onClick={onRemove} aria-label="Remove photo">
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
