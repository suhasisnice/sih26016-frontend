import { useState } from 'react';
import * as casesApi from '../../api/cases';
import { useMutation } from '../../hooks/useApi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Textarea } from '../ui/Field';
import StepUpConfirmModal from './StepUpConfirmModal';

/* The closest thing a case has to "reject" — see CaseHoldRequest's
   docstring on the backend for why this sets CaseStatus.STALLED rather
   than a stage the Act does not have. Always requires a fresh identity
   check: this is exactly the kind of call every officer workspace wants
   accountable to a specific, freshly-confirmed person. */
export default function HoldCaseModal({ caseRecord, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [stepupOpen, setStepupOpen] = useState(false);

  const hold = useMutation((text, stepupToken) => casesApi.hold(caseRecord.id, text, stepupToken));

  async function submit(stepupToken) {
    try {
      await hold.run(note.trim(), stepupToken);
      onDone();
    } catch {
      /* hold.error already carries the message to show */
    }
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
      busy={hold.pending}
      error={hold.error}
      title="Put case on hold"
      subtitle={`${caseRecord.case_number} will stop being counted as active until it is resumed.`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={hold.pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => setStepupOpen(true)}
            disabled={hold.pending || note.trim().length < 3}
          >
            Confirm identity to hold
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        The case stays at its current stage — nothing in its history changes — but it is
        marked stalled until an officer resumes it. Use this when the case cannot proceed as
        submitted, not for routine delay.
      </p>
      <Textarea
        label="Reason for holding this case"
        value={note}
        maxLength={300}
        placeholder="What is wrong, and what needs to happen before this can resume."
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
}
