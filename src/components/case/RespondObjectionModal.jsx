import { useState } from 'react';
import * as objectionsApi from '../../api/objections';
import { useMutation } from '../../hooks/useApi';
import { objectionStatusLabel } from '../../lib/labels';
import { minLength, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select, Textarea } from '../ui/Field';

/* What an officer can record against a Section 15 objection.

   `under_review` is on this list and the other two are not like it: it is
   explicitly NOT a decision. The backend leaves responded_on null for it and
   keeps the objection's clock running, and the case screen keeps offering
   this modal until one of the two real outcomes is recorded. It belongs here
   because taking an objection up and deciding it are genuinely separate acts
   — the same distinction the proposal chain draws between "take up for
   scrutiny" and "sanction" — and without it an officer who had begun a
   hearing but not concluded it had nowhere to say so. */
const OUTCOMES = ['under_review', 'resolved', 'rejected'];

const OUTCOME_NOTE = {
  under_review:
    'Records that the objection has been taken up, without deciding it. It stays open and stays on the overdue count.',
  resolved: 'Decides the objection in the objector’s favour and closes it.',
  rejected: 'Decides the objection against the objector and closes it, with the reasoning below.',
};

export default function RespondObjectionModal({ objection, onClose, onDone }) {
  /* Still defaults to a decision, as it always has — an officer opening this
     from a hearing is usually there to conclude one, and defaulting to the
     non-decision would invite recording "taken up" while meaning "decided".
     Taking an objection up without deciding it is now available, not
     assumed. */
  const [status, setStatus] = useState('resolved');
  /* Carries the interim note forward rather than making the officer retype
     what they wrote when they took the objection up. */
  const [response, setResponse] = useState(objection.response || '');
  const [errors, setErrors] = useState({});

  const save = useMutation(() => objectionsApi.respond(objection.id, { status, response: response.trim() }));

  async function onSave() {
    const result = validate(
      { response },
      { response: [required('Response'), minLength('Response', 5)] },
    );
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run();
      onDone();
    } catch {
      /* useMutation holds it; the modal renders it. */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.pending}
      error={save.error}
      title={status === 'under_review' ? 'Take up this objection' : 'Record a decision'}
      subtitle={`Filed by ${objection.person_name}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending
              ? 'Recording…'
              : status === 'under_review'
                ? 'Take it up'
                : 'Record the decision'}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{objection.grounds}</p>

      <Select
        label="Outcome"
        value={status}
        options={OUTCOMES.map((value) => ({ value, label: objectionStatusLabel(value) }))}
        onChange={(event) => setStatus(event.target.value)}
        hint={OUTCOME_NOTE[status]}
      />

      <Textarea
        label={status === 'under_review' ? 'Note' : 'Response'}
        value={response}
        error={errors.response}
        maxLength={2000}
        placeholder="The grounds raised concern the survey boundary, which has been re-verified against the record and found correct."
        onChange={(event) => {
          setResponse(event.target.value);
          if (errors.response) setErrors({});
        }}
        hint={
          status === 'under_review'
            ? 'Kept on the case. The objector is not notified until the objection is decided.'
            : 'Read by the person who filed this objection.'
        }
      />
    </Modal>
  );
}
