import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Crosshair, X } from 'lucide-react';
import * as surveyApi from '../api/survey';
import { api } from '../api/client';
import { useApi, useMutation } from '../hooks/useApi';
import { useGeolocation, MAX_ACCEPTABLE_ACCURACY_M } from '../hooks/useGeolocation';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import * as fmt from '../lib/format';
import { stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import UploadDocumentModal from '../components/case/UploadDocumentModal';
import Button from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import '../components/case/case.css';
import './fieldwork.css';
import './survey.css';

const MIN_BOUNDARY_CORNERS = 3;

/* The entry portal itself: Start Survey → current location → measured area
   → walk-the-boundary → photos → documents → remarks → Submit. A reviewer
   opening the same task after it's submitted sees Approve/Return instead of
   the edit form. See app/routers/survey.py for the lifecycle this mirrors. */
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

  if (task.loading) return <Loading label="Loading the survey" rows={5} />;
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
        <SurveyEntryForm task={t} onChanged={task.reload} />
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
      </div>

      {t.remarks && (
        <>
          <p className="fact__label" style={{ marginTop: 'var(--s4)' }}>REMARKS</p>
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

/* The actual field work: location, area, boundary, photos, documents,
   remarks, submit. */
function SurveyEntryForm({ task: t, onChanged }) {
  const [areaInput, setAreaInput] = useState(t.measured_area_ha != null ? String(t.measured_area_ha) : '');
  const [remarksInput, setRemarksInput] = useState(t.remarks || '');
  const [corners, setCorners] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const location = useGeolocation();
  const corner = useGeolocation();
  const save = useMutation((payload) => surveyApi.save(t.id, payload));
  const submit = useMutation(() => surveyApi.submit(t.id));
  const uploadPhoto = useMutation((payload) => surveyApi.uploadPhoto(payload));
  const fileInputRef = useRef(null);

  async function onUseLocation() {
    try {
      const fix = await location.capture();
      await save.run({ location: { latitude: fix.latitude, longitude: fix.longitude } });
      onChanged();
    } catch {
      /* location.error / save.error render below */
    }
  }

  async function onAddCorner() {
    try {
      const fix = await corner.capture();
      setCorners((current) => [...current, { latitude: fix.latitude, longitude: fix.longitude }]);
    } catch {
      /* corner.error renders below */
    }
  }

  function onClearCorners() {
    setCorners([]);
  }

  async function onSaveProgress() {
    setSaveError(null);
    const payload = {};
    if (areaInput.trim() !== '') payload.measured_area_ha = Number(areaInput);
    if (corners.length >= MIN_BOUNDARY_CORNERS) payload.boundary_points = corners;
    payload.remarks = remarksInput.trim() || null;
    try {
      await save.run(payload);
      setCorners([]);
      onChanged();
    } catch (err) {
      setSaveError(err);
    }
  }

  async function onPickPhotos(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length === 0) return;

    let fix = location.fix;
    if (!fix) {
      try {
        fix = await location.capture();
      } catch {
        fix = null;
      }
    }

    for (const file of files) {
      try {
        await uploadPhoto.run({
          taskId: t.id,
          file,
          latitude: fix ? fix.latitude : null,
          longitude: fix ? fix.longitude : null,
        });
      } catch {
        /* uploadPhoto.error renders below; stop on first failure */
        break;
      }
    }
    onChanged();
  }

  async function onDeletePhoto(photoId) {
    try {
      await surveyApi.deletePhoto(t.id, photoId);
      onChanged();
    } catch {
      /* swallowed — the photo list simply won't shrink, visible enough */
    }
  }

  async function onSubmit() {
    setSubmitError(null);
    try {
      await submit.run();
      onChanged();
    } catch (err) {
      setSubmitError(err);
    }
  }

  const canSubmit = t.measured_area_ha != null || t.boundary_point_count >= MIN_BOUNDARY_CORNERS || t.photos.length > 0;

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Current location</h2>
        </div>
        <div className={`fix${location.fix && !location.tooLoose ? ' is-good' : ''}${location.tooLoose ? ' is-bad' : ''}`}>
          <p className="fix__head">
            <Crosshair size={15} strokeWidth={1.75} aria-hidden="true" />
            Position from this device
          </p>
          {location.error && <p className="fix__note is-error">{location.error}</p>}
          {location.fix && (
            <p className="fix__coords">
              {location.fix.latitude.toFixed(6)}, {location.fix.longitude.toFixed(6)} — accurate to about{' '}
              {Math.round(location.fix.accuracy)} m
            </p>
          )}
          {!location.fix && t.has_location && !location.error && (
            <p className="fix__note">Already recorded earlier in this survey.</p>
          )}
          <Button variant="secondary" onClick={onUseLocation} disabled={location.locating || save.pending}>
            {location.locating ? 'Getting a fix…' : 'Use current location'}
          </Button>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Measured area</h2>
        </div>
        <Input
          label="Area (hectares)"
          type="number"
          step="0.0001"
          min="0"
          inputMode="decimal"
          value={areaInput}
          onChange={(event) => setAreaInput(event.target.value)}
        />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Boundary</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t.boundary_point_count >= MIN_BOUNDARY_CORNERS
              ? `${t.boundary_point_count} corners on file`
              : 'Not walked yet'}
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 'var(--s3)' }}>
          Walk the parcel and tap "Add corner" at each corner, in order. At least {MIN_BOUNDARY_CORNERS}{' '}
          are needed before it can be saved as a boundary.
        </p>
        {corner.error && <p className="fix__note is-error">{corner.error}</p>}
        {corners.length > 0 && (
          <ol className="survey-corners">
            {corners.map((point, index) => (
              <li key={index}>
                Corner {index + 1}: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
              </li>
            ))}
          </ol>
        )}
        <span style={{ display: 'flex', gap: 'var(--s3)' }}>
          <Button variant="secondary" onClick={onAddCorner} disabled={corner.locating}>
            {corner.locating ? 'Getting a fix…' : 'Add corner'}
          </Button>
          {corners.length > 0 && (
            <Button variant="quiet" onClick={onClearCorners}>
              Clear
            </Button>
          )}
        </span>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Photos</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.photos.length}</span>
        </div>
        {uploadPhoto.error && <ErrorState error={uploadPhoto.error} title="Photo could not be uploaded" />}
        {t.photos.length > 0 && (
          <div className="survey-photos">
            {t.photos.map((photo) => (
              <PhotoThumbnail key={photo.id} taskId={t.id} photo={photo} onRemove={() => onDeletePhoto(photo.id)} />
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          style={{ display: 'none' }}
          onChange={onPickPhotos}
        />
        <Button variant="secondary" onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={uploadPhoto.pending}>
          {uploadPhoto.pending ? 'Uploading…' : 'Take a photo'}
        </Button>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Documents</h2>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 'var(--s3)' }}>
          Formal records — land records, survey maps, ownership proof — go on the case's document
          list, not here.
        </p>
        <Button variant="secondary" onClick={() => setUploadOpen(true)}>
          Upload document
        </Button>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Remarks</h2>
        </div>
        <Textarea
          label="Field notes"
          value={remarksInput}
          maxLength={4000}
          rows={4}
          placeholder="Boundary condition, access issues, anything the reviewer should know."
          onChange={(event) => setRemarksInput(event.target.value)}
        />
      </section>

      {saveError && <ErrorState error={saveError} title="Could not save" />}
      <div className="survey-actions">
        <Button variant="secondary" block onClick={onSaveProgress} disabled={save.pending}>
          {save.pending ? 'Saving…' : 'Save progress'}
        </Button>
        {submitError && <ErrorState error={submitError} title="Could not submit" />}
        <Button variant="primary" block onClick={onSubmit} disabled={submit.pending || !canSubmit}>
          {submit.pending ? 'Submitting…' : 'Submit survey report'}
        </Button>
        {!canSubmit && (
          <p style={{ fontSize: 11.5, color: 'var(--text-faint)', textAlign: 'center' }}>
            Record a measured area, a boundary, or at least one photo before submitting.
          </p>
        )}
      </div>

      {uploadOpen && (
        <UploadDocumentModal
          caseId={t.case_id}
          onClose={() => setUploadOpen(false)}
          onDone={() => setUploadOpen(false)}
        />
      )}
    </>
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
      {photo.caption && <span className="survey-photo__caption">{photo.caption}</span>}
      {onRemove && (
        <button type="button" className="survey-photo__remove" onClick={onRemove} aria-label="Remove photo">
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
