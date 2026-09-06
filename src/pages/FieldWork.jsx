import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as dashboardApi from '../api/dashboard';
import * as personsApi from '../api/persons';
import * as surveyApi from '../api/survey';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import { docTypeLabel, stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import CaptureParcelModal from '../components/case/CaptureParcelModal';
import UploadDocumentModal from '../components/case/UploadDocumentModal';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import '../components/case/case.css';
import './fieldwork.css';

/* The field officer's queue: cases in an on-ground stage (social impact
   assessment, land verification, objection period) with something a site
   visit would actually resolve. GET /dashboard/field-work already excludes
   a case with nothing outstanding, so every card here is real work, not
   everything currently open — CaseDetail is still where the full record
   lives, this is just where "what do I do today" gets answered.

   A phone-first card list rather than DataTable's wide columns, per
   CLAUDE.md 3.6's explicit requirement that this view work on a phone. */
export default function FieldWork() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queue = useApi((opts) => dashboardApi.fieldWork({}, opts), []);

  const [modal, setModal] = useState(null); // { kind: 'capture'|'upload', item, people? }
  const [preparingFor, setPreparingFor] = useState(null);
  const [prepareError, setPrepareError] = useState(null);

  const startSurvey = useMutation((caseId) => surveyApi.create({ caseId }));
  const [startingFor, setStartingFor] = useState(null);
  const [startError, setStartError] = useState(null);

  async function openCapture(item) {
    setPrepareError(null);
    setPreparingFor(item.case_id);
    try {
      const people = await personsApi.forCase(item.case_id);
      setModal({ kind: 'capture', item, people: people.items });
    } catch (err) {
      setPrepareError(err);
    } finally {
      setPreparingFor(null);
    }
  }

  async function onStartSurvey(item) {
    setStartError(null);
    setStartingFor(item.case_id);
    try {
      const task = await startSurvey.run(item.case_id);
      navigate(`/survey-tasks/${task.id}`);
    } catch (err) {
      setStartError(err);
    } finally {
      setStartingFor(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Field work"
        subtitle="Cases in your district with something a site visit would resolve — not everything open, only what still needs you."
      />

      {queue.loading && <Loading label="Loading field work" rows={3} />}
      {queue.error && <ErrorState error={queue.error} onRetry={queue.reload} />}
      {prepareError && (
        <ErrorState
          title="Could not load this case's households"
          error={prepareError}
          onRetry={() => setPrepareError(null)}
        />
      )}
      {startError && (
        <ErrorState
          title="Could not start the survey"
          error={startError}
          onRetry={() => setStartError(null)}
        />
      )}

      {queue.data && queue.data.items.length === 0 && (
        <Empty
          center
          title="Nothing needs a site visit right now"
          body="Every case in an on-ground stage in your district has its parcels surveyed and its documents on file."
        />
      )}

      {queue.data && queue.data.items.length > 0 && (
        <div className="field-queue">
          {queue.data.items.map((item) => (
            <article
              key={item.case_id}
              className={`field-card${item.timeline_status === 'breached' ? ' is-overdue' : ''}`}
            >
              <header className="field-card__head">
                <div>
                  <span className="case-number">{item.case_number}</span>
                  <h2 className="field-card__village">{item.village_name}</h2>
                  <p className="field-card__project">
                    {item.project_name} · {item.district_name}
                  </p>
                </div>
                <StatusBadge kind="timeline" value={item.timeline_status} />
              </header>

              <p className="field-card__stage">
                {stageLabel(item.stage)}
                {item.stage_due_on && (
                  <span className="field-card__due">
                    {' · '}
                    {item.days_remaining < 0
                      ? `${Math.abs(item.days_remaining)} days overdue`
                      : `${item.days_remaining} days left`}
                  </span>
                )}
              </p>

              <ul className="field-card__tasks">
                {item.parcel_count === 0 && <li>No parcels captured yet</li>}
                {item.parcels_missing_boundary > 0 && (
                  <li>
                    {item.parcels_missing_boundary} parcel{item.parcels_missing_boundary === 1 ? '' : 's'}{' '}
                    awaiting a surveyed boundary
                  </li>
                )}
                {item.missing_document_types.map((docType) => (
                  <li key={docType}>Missing: {docTypeLabel(docType)}</li>
                ))}
              </ul>

              <footer className="field-card__actions">
                {can.performSurvey(user) && (
                  <Button
                    variant="primary"
                    onClick={() => onStartSurvey(item)}
                    disabled={startingFor === item.case_id}
                  >
                    {startingFor === item.case_id ? 'Starting…' : 'Start survey'}
                  </Button>
                )}
                {can.createParcel(user) && (
                  <Button
                    variant="secondary"
                    onClick={() => openCapture(item)}
                    disabled={preparingFor === item.case_id}
                  >
                    {preparingFor === item.case_id ? 'Loading…' : 'Capture parcel'}
                  </Button>
                )}
                {can.uploadDocument(user) && (
                  <Button variant="secondary" onClick={() => setModal({ kind: 'upload', item })}>
                    Upload document
                  </Button>
                )}
                <Button variant="link" to={`/cases/${item.case_id}`}>
                  Open case
                </Button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {modal && modal.kind === 'capture' && (
        <CaptureParcelModal
          caseRecord={{ id: modal.item.case_id, case_number: modal.item.case_number }}
          people={modal.people}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            queue.reload();
          }}
        />
      )}
      {modal && modal.kind === 'upload' && (
        <UploadDocumentModal
          caseId={modal.item.case_id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            queue.reload();
          }}
        />
      )}
    </>
  );
}
