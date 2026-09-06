import { useMemo, useState } from 'react';
import * as casesApi from '../../api/cases';
import { useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import { stageLabel, stageSection } from '../../lib/labels';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select, Textarea } from '../ui/Field';
import StepUpConfirmModal from './StepUpConfirmModal';

/* Mirrors app.routers.cases.STEPUP_REQUIRED_STAGES on the backend, which
   is the actual authority — this only decides whether to show the
   confirm-identity step before submitting; the backend refuses the
   request regardless of what this thinks if the token is missing or
   stale. Declaration, Award and Possession are fixed values; the fourth
   (the case's final stage) is read from the live enum list rather than
   hardcoded, since "final" moves if the statutory sequence ever does. */
function stepupRequiredStages(stages) {
  return new Set(['declaration', 'award', 'possession', stages[stages.length - 1]]);
}

/* Moving a case along, with a confirm step. Small, and it makes the timeline
   come alive.

   The options come from `allowed_next_stages` on the case itself, so the
   dropdown can only ever offer transitions the backend will accept. That
   list includes the previous stage as well as the next — sending a case back
   is legal under the Act and happens, and hiding it would misrepresent the
   process. It is not the default, though: the API returns the list in
   statutory order, so the earlier stage comes first, and defaulting to it
   would mean the primary button on this screen moves a case backwards. */
export default function AdvanceStageModal({ caseRecord, onClose, onDone }) {
  const { stages } = useEnums();

  /* Memoised because it is a dependency below: `x || []` is a fresh array
     identity on every render, which would defeat the useMemo that reads it. */
  const options = useMemo(
    () => caseRecord.allowed_next_stages || [],
    [caseRecord.allowed_next_stages],
  );

  /* Forward is the next stage after the current one in statutory order.
     Falls back to the first option when the enums have not loaded or the
     only legal move is backwards. */
  const forward = useMemo(() => {
    const currentIndex = stages.indexOf(caseRecord.stage);
    if (currentIndex === -1) return options[0] || '';
    const ahead = options.filter((value) => stages.indexOf(value) > currentIndex);
    return ahead[0] || options[0] || '';
  }, [stages, options, caseRecord.stage]);

  const [toStage, setToStage] = useState(forward);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [stepupOpen, setStepupOpen] = useState(false);

  const advance = useMutation((stage, text, stepupToken) =>
    casesApi.advance(caseRecord.id, stage, text, stepupToken),
  );

  /* Sending a case back is a different kind of act from moving it on, and
     the confirm step says so rather than using one neutral wording. */
  const isBackward =
    stages.indexOf(toStage) !== -1 &&
    stages.indexOf(toStage) < stages.indexOf(caseRecord.stage);

  // The backend refuses a send-back with no note regardless — checked here
  // too so the person finds out before the confirm step, not after.
  const noteRequired = isBackward;
  const needsStepup = stepupRequiredStages(stages).has(toStage);

  async function submit(stepupToken) {
    try {
      await advance.run(toStage, note.trim() || null, stepupToken);
      onDone();
    } catch {
      // useMutation holds the error; the modal renders it.
      setConfirming(false);
    }
  }

  function onConfirm() {
    if (needsStepup) {
      setStepupOpen(true);
      return;
    }
    submit(undefined);
  }

  if (stepupOpen) {
    return (
      <StepUpConfirmModal
        open
        onClose={() => setStepupOpen(false)}
        onVerified={(token) => {
          setStepupOpen(false);
          submit(token);
        }}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={advance.pending}
      error={advance.error}
      title={confirming ? 'Confirm the change' : 'Advance stage'}
      subtitle={
        confirming
          ? undefined
          : `${caseRecord.case_number} is at ${stageLabel(caseRecord.stage)}.`
      }
      footer={
        confirming ? (
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)} disabled={advance.pending}>
              Back
            </Button>
            <Button
              variant={isBackward ? 'danger' : 'primary'}
              onClick={onConfirm}
              disabled={advance.pending || (noteRequired && !note.trim())}
            >
              {advance.pending
                ? 'Recording…'
                : needsStepup
                  ? 'Confirm identity to record'
                  : 'Record the change'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setConfirming(true)} disabled={!toStage}>
              Continue
            </Button>
          </>
        )
      }
    >
      {confirming ? (
        <>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            {caseRecord.case_number} will move {isBackward ? 'back ' : ''}from{' '}
            <strong>{stageLabel(caseRecord.stage)}</strong> to{' '}
            <strong>{stageLabel(toStage)}</strong>
            {stageSection(toStage) ? ` (${stageSection(toStage)})` : ''}.
          </p>

          {isBackward && (
            <p style={{ fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.6 }}>
              This returns the case to an earlier stage. The stages already recorded
              stay in the history — nothing is erased — but the case will again be
              measured against what that earlier stage requires.
            </p>
          )}

          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            This is recorded in the case history and the audit trail against your
            name, and it changes which documents the case is required to hold.
          </p>

          {note.trim() && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Note: <em>{note.trim()}</em>
            </p>
          )}
        </>
      ) : (
        <>
          <Select
            label="Move to"
            value={toStage}
            options={options.map((value) => ({
              value,
              label:
                stages.indexOf(value) < stages.indexOf(caseRecord.stage)
                  ? `${stageLabel(value)} — send back`
                  : stageLabel(value),
            }))}
            onChange={(event) => setToStage(event.target.value)}
            hint="Only transitions the Act permits from the current stage are listed."
          />
          <Textarea
            label={noteRequired ? 'Note (required for a send-back)' : 'Note (optional)'}
            value={note}
            maxLength={300}
            placeholder="Why the case is moving — the gazette date, the hearing outcome, the award number."
            onChange={(event) => setNote(event.target.value)}
          />
          {needsStepup && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Moving to {stageLabel(toStage)} needs a fresh identity check — you&rsquo;ll be asked
              to confirm by face or fingerprint before this is recorded.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
