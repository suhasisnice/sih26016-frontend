import { useState } from 'react';
import * as grievancesApi from '../../api/grievances';
import { useMutation } from '../../hooks/useApi';
import { grievanceStatusLabel } from '../../lib/labels';
import { minLength, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select, Textarea } from '../ui/Field';

/* Every forward move a grievance can make from an open state. `closed` is
   offered alongside `resolved` deliberately: a grievance can be closed
   without ever being decided in the filer's favour (withdrawn, a duplicate,
   overtaken by events), which is a different fact from "resolved". */
const OUTCOMES = ['assigned', 'under_review', 'info_required', 'response_provided', 'resolved', 'closed'];

const OUTCOME_NOTE = {
  assigned: 'Records who is now handling this, without answering it yet.',
  under_review: 'Records that it is actively being looked into.',
  info_required: 'Tells the filer more is needed from them before this can move on.',
  response_provided: 'Gives the filer a substantive answer, without closing the matter.',
  resolved: 'Decides the grievance in the filer’s favour and closes it.',
  closed: 'Closes the grievance without a decision — withdrawn, a duplicate, or overtaken by events.',
};

const FINAL_STATUSES = ['response_provided', 'resolved', 'closed'];

export default function RespondGrievanceModal({ grievance, onClose, onDone }) {
  const [status, setStatus] = useState('under_review');
  const [response, setResponse] = useState(grievance.response || '');
  const [errors, setErrors] = useState({});

  const save = useMutation(() => grievancesApi.respond(grievance.id, status, response.trim()));

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
      title="Update this grievance"
      subtitle={`${grievance.grievance_number} — filed by ${grievance.person_name}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Recording…' : 'Record the update'}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{grievance.description}</p>

      <Select
        label="Status"
        value={status}
        options={OUTCOMES.map((value) => ({ value, label: grievanceStatusLabel(value) }))}
        onChange={(event) => setStatus(event.target.value)}
        hint={OUTCOME_NOTE[status]}
      />

      <Textarea
        label="Response"
        value={response}
        error={errors.response}
        maxLength={2000}
        placeholder="The market value comparables have been re-checked against the assessment on file and found correct."
        onChange={(event) => {
          setResponse(event.target.value);
          if (errors.response) setErrors({});
        }}
        hint={
          FINAL_STATUSES.includes(status)
            ? 'Read by the person who filed this grievance, and sent to them as a notification.'
            : 'Kept on the grievance. The filer is still notified of this status change.'
        }
      />
    </Modal>
  );
}
