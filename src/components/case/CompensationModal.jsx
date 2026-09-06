import { useState } from 'react';
import * as personsApi from '../../api/persons';
import { useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import * as fmt from '../../lib/format';
import { compensationStatusLabel } from '../../lib/labels';
import { isNumber, notNegative, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select } from '../ui/Field';

/* Record a payment or correct an award. Compensation is edited on its own,
   never alongside R&R (see RnrModal) — a merged form would misrepresent
   exactly the households the two figures exist to tell apart.

   The award itself is never a typed-in total: Sec. 26-30 build it from
   market value plus a statutory solatium (fixed at 100% of market value by
   Sec. 30(1)) plus Sec. 34 delay interest, so this form edits those three
   inputs and shows the resulting award as a computed read-out rather than
   a field — matching what the backend actually accepts. */
export default function CompensationModal({ person, onClose, onDone }) {
  const { compensation_statuses: statuses } = useEnums();
  const c = person.compensation;

  const [values, setValues] = useState({
    market_value_amount: String(c.market_value_amount),
    solatium_rate_pct: String(c.solatium_rate_pct),
    interest_amount: String(c.interest_amount),
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

  const marketValue = Number(values.market_value_amount) || 0;
  const solatiumRate = Number(values.solatium_rate_pct) || 0;
  const interest = Number(values.interest_amount) || 0;
  const solatiumAmount = Math.round((marketValue * solatiumRate) / 100);
  const projectedAward = marketValue + solatiumAmount + interest;

  async function onSave() {
    const result = validate(values, {
      market_value_amount: [isNumber('Market value'), notNegative('Market value')],
      solatium_rate_pct: [isNumber('Solatium rate'), notNegative('Solatium rate')],
      interest_amount: [isNumber('Interest'), notNegative('Interest')],
      amount_paid: [isNumber('Amount paid'), notNegative('Amount paid')],
    });
    if (!result.errors.solatium_rate_pct && solatiumRate > 100) {
      result.errors.solatium_rate_pct = 'Cannot exceed 100% (Sec. 30(1))';
      result.isValid = false;
    }
    if (!result.errors.amount_paid && Number(values.amount_paid) > projectedAward) {
      result.errors.amount_paid = 'Cannot exceed the awarded amount';
      result.isValid = false;
    }
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run({
        market_value_amount: marketValue,
        solatium_rate_pct: solatiumRate,
        interest_amount: interest,
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
        label="Market value (₹) — Sec. 26"
        value={values.market_value_amount}
        error={errors.market_value_amount}
        inputMode="numeric"
        onChange={(event) => set('market_value_amount', event.target.value)}
      />
      <Input
        label="Solatium rate (%) — Sec. 30(1)"
        value={values.solatium_rate_pct}
        error={errors.solatium_rate_pct}
        inputMode="numeric"
        onChange={(event) => set('solatium_rate_pct', event.target.value)}
        hint="Fixed at 100% of market value under the current Act."
      />
      <Input
        label="Delay interest (₹) — Sec. 34"
        value={values.interest_amount}
        error={errors.interest_amount}
        inputMode="numeric"
        onChange={(event) => set('interest_amount', event.target.value)}
        hint="Only applies once payment has fallen behind."
      />

      <div className="fix">
        <span className="fix__head">Award (computed)</span>
        <span className="fix__coords">{fmt.rupeesPlain(projectedAward)}</span>
        <span className="fix__note">
          {fmt.rupeesPlain(marketValue)} market value + {fmt.rupeesPlain(solatiumAmount)} solatium
          {interest > 0 ? ` + ${fmt.rupeesPlain(interest)} interest` : ''}
        </span>
      </div>

      <Input
        label="Amount paid (₹)"
        value={values.amount_paid}
        error={errors.amount_paid}
        inputMode="numeric"
        onChange={(event) => set('amount_paid', event.target.value)}
        hint="Cannot exceed the computed award."
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
