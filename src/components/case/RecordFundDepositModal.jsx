import { useState } from 'react';
import * as casesApi from '../../api/cases';
import { useMutation } from '../../hooks/useApi';
import { isNumber, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/Field';

/* Record that the requiring body's money has landed. A ledger entry, not a
   single flag — a part payment topped up later is normal, which is why
   this opens a new row rather than editing one that might already exist. */
export default function RecordFundDepositModal({ caseRecord, onClose, onDone }) {
  const [values, setValues] = useState({
    amount: '',
    deposited_on: new Date().toISOString().slice(0, 10),
    reference: '',
  });
  const [errors, setErrors] = useState({});

  const save = useMutation((payload) => casesApi.recordFundDeposit(caseRecord.id, payload));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSave() {
    const result = validate(values, {
      amount: [required('Amount'), isNumber('Amount')],
      deposited_on: [required('Date')],
    });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run({
        amount: Number(values.amount),
        deposited_on: values.deposited_on,
        reference: values.reference.trim() || null,
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
      title="Record a fund deposit"
      subtitle={caseRecord.case_number}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Saving…' : 'Record deposit'}
          </Button>
        </>
      }
    >
      <Input
        label="Amount (₹)"
        value={values.amount}
        error={errors.amount}
        inputMode="numeric"
        onChange={(event) => set('amount', event.target.value)}
        hint="Whole rupees, as the requiring body's challan states."
      />
      <Input
        label="Deposited on"
        type="date"
        value={values.deposited_on}
        error={errors.deposited_on}
        onChange={(event) => set('deposited_on', event.target.value)}
      />
      <Input
        label="Reference (optional)"
        value={values.reference}
        maxLength={120}
        placeholder="Challan or UTR number"
        onChange={(event) => set('reference', event.target.value)}
      />
    </Modal>
  );
}
