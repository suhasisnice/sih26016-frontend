import { useState } from 'react';
import * as objectionsApi from '../../api/objections';
import { useMutation } from '../../hooks/useApi';
import { objectionStatusLabel } from '../../lib/labels';
import { minLength, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select, Textarea } from '../ui/Field';

/* Record the outcome of a Section 15 hearing. The two real outcomes an
   objection can be given a reasoned response for. */
const OUTCOMES = ['resolved', 'rejected'];

export default function RespondObjectionModal({ objection, onClose, onDone }) {
  const [status, setStatus] = useState('resolved');
  const [response, setResponse] = useState('');
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
      title="Record a response"
      subtitle={`Filed by ${objection.person_name}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Recording…' : 'Record response'}
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
      />

      <Textarea
        label="Response"
        value={response}
        error={errors.response}
        maxLength={2000}
        placeholder="The grounds raised concern the survey boundary, which has been re-verified against the record and found correct."
        onChange={(event) => {
          setResponse(event.target.value);
          if (errors.response) setErrors({});
        }}
        hint="Read by the person who filed this objection."
      />
    </Modal>
  );
}
