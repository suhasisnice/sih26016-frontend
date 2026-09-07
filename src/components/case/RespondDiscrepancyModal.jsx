import { useState } from 'react';
import * as discrepanciesApi from '../../api/discrepancies';
import { useMutation } from '../../hooks/useApi';
import { minLength, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Textarea } from '../ui/Field';

/* Clear a field-survey discrepancy report. Mirrors RespondObjectionModal —
   the review action is simpler here (there's no reject/under-review path,
   just OPEN -&gt; RESOLVED, per SurveyDiscrepancy's own docstring), so this
   is one text field rather than a status picker plus one. */
export default function RespondDiscrepancyModal({ discrepancy, onClose, onDone }) {
  const [response, setResponse] = useState('');
  const [errors, setErrors] = useState({});

  const save = useMutation(() => discrepanciesApi.respond(discrepancy.id, response.trim()));

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
      title="Resolve discrepancy"
      subtitle={`Filed by ${discrepancy.filed_by_name}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Saving…' : 'Mark resolved'}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{discrepancy.description}</p>

      <Textarea
        label="Response"
        value={response}
        error={errors.response}
        maxLength={2000}
        placeholder="What was checked, and how it was resolved."
        onChange={(event) => {
          setResponse(event.target.value);
          if (errors.response) setErrors({});
        }}
      />
    </Modal>
  );
}
