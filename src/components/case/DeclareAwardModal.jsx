import { useState } from 'react';
import * as personsApi from '../../api/persons';
import { useMutation } from '../../hooks/useApi';
import * as fmt from '../../lib/format';
import { isNumber, notNegative, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/Field';

/* Open the first award for a household that has none yet. Only shown for a
   household that actually owns acquired land here (PeoplePanel checks
   parcel_count before offering this) — awarding a household with nothing
   taken from it is not a state the Act allows.

   Sec. 30(1) fixes solatium at 100% of market value, so it is pre-filled
   rather than left blank; interest defaults to zero since an award is not
   yet late the moment it is first declared. */
export default function DeclareAwardModal({ person, caseId, onClose, onDone }) {
  const [values, setValues] = useState({
    market_value_amount: '',
    solatium_rate_pct: '100',
    interest_amount: '0',
    awarded_on: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState({});

  const save = useMutation((payload) => personsApi.createCompensation(payload));

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
      market_value_amount: [required('Market value'), isNumber('Market value'), notNegative('Market value')],
      solatium_rate_pct: [isNumber('Solatium rate'), notNegative('Solatium rate')],
      interest_amount: [isNumber('Interest'), notNegative('Interest')],
    });
    if (!result.errors.solatium_rate_pct && solatiumRate > 100) {
      result.errors.solatium_rate_pct = 'Cannot exceed 100% (Sec. 30(1))';
      result.isValid = false;
    }
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run({
        case_id: caseId,
        person_id: person.person_id,
        market_value_amount: marketValue,
        solatium_rate_pct: solatiumRate,
        interest_amount: interest,
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
      title="Declare award"
      subtitle={person.name}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Saving…' : 'Declare'}
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
        label="Awarded on"
        type="date"
        value={values.awarded_on}
        onChange={(event) => set('awarded_on', event.target.value)}
      />
    </Modal>
  );
}
