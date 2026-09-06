import { useState } from 'react';
import * as surveyApi from '../../api/survey';
import { useApi, useMutation } from '../../hooks/useApi';
import { required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';

/* A supervisor handing a named field officer a survey to go do — the other
   half of app.routers.survey's create endpoint from CaptureParcelModal's
   self-service path. Only field officers in the case's own district are
   offered, matching the backend's own check. */
export default function AssignSurveyModal({ caseRecord, parcels, onClose, onDone }) {
  const officers = useApi(
    (opts) => surveyApi.assignableOfficers(caseRecord.district_id, opts),
    [caseRecord.district_id],
  );

  const [values, setValues] = useState({
    assigned_to_user_id: '',
    parcel_id: '',
    due_on: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const create = useMutation((payload) => surveyApi.create(payload));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSubmit() {
    const result = validate(values, { assigned_to_user_id: [required('Field officer')] });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await create.run({
        caseId: caseRecord.id,
        parcelId: values.parcel_id ? Number(values.parcel_id) : null,
        assignedToUserId: Number(values.assigned_to_user_id),
        dueOn: values.due_on || null,
        notes: values.notes.trim() || null,
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
      busy={create.pending}
      error={create.error}
      title="Assign a survey"
      subtitle={caseRecord.case_number}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={create.pending}>
            {create.pending ? 'Assigning…' : 'Assign'}
          </Button>
        </>
      }
    >
      <Select
        label="Field officer"
        value={values.assigned_to_user_id}
        error={errors.assigned_to_user_id}
        placeholder={officers.loading ? 'Loading officers…' : 'Choose an officer'}
        options={(officers.data || []).map((o) => ({ value: String(o.id), label: o.full_name }))}
        onChange={(event) => set('assigned_to_user_id', event.target.value)}
      />
      {officers.data && officers.data.length === 0 && !officers.loading && (
        <p className="field__hint" style={{ marginTop: '-8px' }}>
          No field officer is on record for this district yet.
        </p>
      )}

      <Select
        label="Parcel (optional)"
        value={values.parcel_id}
        placeholder="Whole case — no specific parcel"
        options={parcels.map((p) => ({ value: String(p.id), label: `${p.survey_number} — ${p.owner_name}` }))}
        onChange={(event) => set('parcel_id', event.target.value)}
        hint="Leave unset for case-level fieldwork, like a social impact assessment visit."
      />

      <Input
        label="Due on (optional)"
        type="date"
        value={values.due_on}
        onChange={(event) => set('due_on', event.target.value)}
      />

      <Textarea
        label="Notes (optional)"
        value={values.notes}
        maxLength={500}
        placeholder="What to look for, or anything specific to this visit."
        onChange={(event) => set('notes', event.target.value)}
      />
    </Modal>
  );
}
