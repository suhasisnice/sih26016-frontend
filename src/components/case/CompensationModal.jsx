import { useState } from 'react';
import * as personsApi from '../../api/persons';
import { useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import { compensationStatusLabel } from '../../lib/labels';
import { isNumber, notNegative, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select } from '../ui/Field';

/* Record a payment or correct an award. Compensation is edited on its own,
   never alongside R&R (see RnrModal) — a merged form would misrepresent
   exactly the households the two figures exist to tell apart. */
export default function CompensationModal({ person, onClose, onDone }) {
  const { compensation_statuses: statuses } = useEnums();
  const c = person.compensation;

  const [values, setValues] = useState({
    amount_awarded: String(c.amount_awarded),
    amount_paid: String(c.amount_paid),
    status: c.status,
    awarded_on: c.awarded_on || '',
  });
  const [errors, setErrors] = useState({});

  const save = useMutation((payload) => personsApi.updateCompensation(c.id, payload));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSave() {
    const result = validate(values, {
      amount_awarded: [isNumber('Amount awarded'), notNegative('Amount awarded')],
      amount_paid: [isNumber('Amount paid'), notNegative('Amount paid')],
    });
    if (!result.errors.amount_paid && Number(values.amount_paid) > Number(values.amount_awarded)) {
      result.errors.amount_paid = 'Cannot exceed the amount awarded';
      result.isValid = false;
    }
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run({
        amount_awarded: Number(values.amount_awarded),
        amount_paid: Number(values.amount_paid),
        status: values.status,
        awarded_on: values.awarded_on || null,
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
      title="Update compensation"
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
      <Input
        label="Amount awarded (₹)"
        value={values.amount_awarded}
        error={errors.amount_awarded}
        inputMode="numeric"
        onChange={(event) => set('amount_awarded', event.target.value)}
      />
      <Input
        label="Amount paid (₹)"
        value={values.amount_paid}
        error={errors.amount_paid}
        inputMode="numeric"
        onChange={(event) => set('amount_paid', event.target.value)}
        hint="Cannot exceed the amount awarded."
      />
      <Select
        label="Status"
        value={values.status}
        options={(statuses.length ? statuses : [c.status]).map((value) => ({
          value,
          label: compensationStatusLabel(value),
        }))}
        onChange={(event) => set('status', event.target.value)}
      />
      <Input
        label="Awarded on"
        type="date"
        value={values.awarded_on}
        onChange={(event) => set('awarded_on', event.target.value)}
      />
    </Modal>
  );
}
