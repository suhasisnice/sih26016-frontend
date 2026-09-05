import { useState } from 'react';
import * as personsApi from '../../api/persons';
import { useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import { rnrStatusLabel } from '../../lib/labels';
import { maxLength, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select, Textarea } from '../ui/Field';

/* Rehabilitation & resettlement, edited separately from compensation — a
   household with no land title has no compensation record at all and still
   has this one. */
export default function RnrModal({ person, onClose, onDone }) {
  const { rnr_statuses: statuses } = useEnums();
  const r = person.rnr;

  const [values, setValues] = useState({
    status: r.status,
    entitlement: r.entitlement || '',
  });
  const [errors, setErrors] = useState({});

  const save = useMutation((payload) => personsApi.updateRnr(r.id, payload));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSave() {
    const result = validate(values, { entitlement: [maxLength('Entitlement', 200)] });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run({
        status: values.status,
        entitlement: values.entitlement.trim() || null,
      });
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
      title="Update R&R entitlement"
      subtitle={person.name}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <Select
        label="Status"
        value={values.status}
        options={(statuses.length ? statuses : [r.status]).map((value) => ({
          value,
          label: rnrStatusLabel(value),
        }))}
        onChange={(event) => set('status', event.target.value)}
      />
      <Textarea
        label="Entitlement"
        value={values.entitlement}
        error={errors.entitlement}
        maxLength={200}
        placeholder="Housing site and construction assistance"
        onChange={(event) => set('entitlement', event.target.value)}
        hint="What this household is entitled to under the R&R scheme."
      />
    </Modal>
  );
}
