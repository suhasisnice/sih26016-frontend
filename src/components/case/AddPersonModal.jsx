import { useState } from 'react';
import * as personsApi from '../../api/persons';
import * as referenceApi from '../../api/reference';
import { useApi, useMutation } from '../../hooks/useApi';
import { maxLength, phone, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select } from '../ui/Field';

/* Add an affected household to a case.

   Land title and being a landowner in this case are asked separately, because
   they are separate facts: someone can hold title to land elsewhere and still
   be a landless affected party here. An R&R entitlement is opened for every
   household added, titled or not. */
export default function AddPersonModal({ caseRecord, onClose, onDone }) {
  const villages = useApi(
    (opts) => referenceApi.villages(caseRecord.district_id, opts),
    [caseRecord.district_id],
  );

  const [values, setValues] = useState({
    name: '',
    village_id: String(caseRecord.village_id || ''),
    phone: '',
    has_land_title: 'true',
    is_landowner: 'false',
    rnr_entitlement: '',
  });
  const [errors, setErrors] = useState({});

  const save = useMutation((payload) => personsApi.create(payload));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSave() {
    const result = validate(values, {
      name: [required('Name'), maxLength('Name', 120)],
      village_id: [required('Village')],
      phone: [phone('Phone')],
    });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run({
        case_id: caseRecord.id,
        name: values.name.trim(),
        village_id: Number(values.village_id),
        phone: values.phone.trim() || null,
        has_land_title: values.has_land_title === 'true',
        is_landowner: values.is_landowner === 'true',
        rnr_entitlement: values.rnr_entitlement.trim() || null,
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
      title="Add an affected household"
      subtitle={caseRecord.case_number}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Adding…' : 'Add household'}
          </Button>
        </>
      }
    >
      <Input
        label="Name"
        value={values.name}
        error={errors.name}
        placeholder="M. Venkata Subbaiah"
        onChange={(event) => set('name', event.target.value)}
      />

      <Select
        label="Village"
        value={values.village_id}
        error={errors.village_id}
        placeholder={villages.loading ? 'Loading villages…' : 'Choose a village'}
        options={(villages.data || []).map((v) => ({ value: String(v.id), label: v.name }))}
        onChange={(event) => set('village_id', event.target.value)}
      />

      <Input
        label="Phone (optional)"
        value={values.phone}
        error={errors.phone}
        inputMode="numeric"
        onChange={(event) => set('phone', event.target.value)}
      />

      <Select
        label="Holds land title"
        value={values.has_land_title}
        options={[
          { value: 'true', label: 'Yes — recorded title holder' },
          { value: 'false', label: 'No — tenant, labourer or occupant' },
        ]}
        onChange={(event) => set('has_land_title', event.target.value)}
      />

      <Select
        label="Owns land in this acquisition"
        value={values.is_landowner}
        options={[
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No — affected but owns none of these parcels' },
        ]}
        onChange={(event) => set('is_landowner', event.target.value)}
        hint="Separate from title: a titled owner elsewhere can be landless here."
      />

      <Input
        label="R&R entitlement (optional)"
        value={values.rnr_entitlement}
        maxLength={200}
        placeholder="Housing site and construction assistance"
        onChange={(event) => set('rnr_entitlement', event.target.value)}
        hint="A resettlement record is opened either way — every displaced household is entitled."
      />
    </Modal>
  );
}
