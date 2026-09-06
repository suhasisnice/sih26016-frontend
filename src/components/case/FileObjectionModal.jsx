import { useState } from 'react';
import * as objectionsApi from '../../api/objections';
import { useMutation } from '../../hooks/useApi';
import { minLength, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Textarea } from '../ui/Field';

/* A Section 15 objection, filed by the landowner themselves. The backend
   takes the person from the caller's own account for this role — case_id
   and grounds are the only fields this form has to send. */
export default function FileObjectionModal({ caseRecord, onClose, onDone }) {
  const [grounds, setGrounds] = useState('');
  const [errors, setErrors] = useState({});

  const save = useMutation(() =>
    objectionsApi.create({ case_id: caseRecord.id, grounds: grounds.trim() }),
  );

  async function onSave() {
    const result = validate(
      { grounds },
      { grounds: [required('Grounds'), minLength('Grounds', 10)] },
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
      title="File an objection"
      subtitle={caseRecord.case_number}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Filing…' : 'File objection'}
          </Button>
        </>
      }
    >
      <Textarea
        label="Grounds"
        value={grounds}
        error={errors.grounds}
        maxLength={2000}
        placeholder="State what is wrong with the notified acquisition — the survey boundary, the recorded owner, the valuation, or anything else at issue."
        onChange={(event) => {
          setGrounds(event.target.value);
          if (errors.grounds) setErrors({});
        }}
        hint="Read by the Special Land Acquisition Officer handling this case, under Section 15."
      />
    </Modal>
  );
}
