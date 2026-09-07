import { useState } from 'react';
import * as discrepanciesApi from '../../api/discrepancies';
import { useMutation } from '../../hooks/useApi';
import { discrepancyTypeLabel } from '../../lib/labels';
import { minLength, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select, Textarea } from '../ui/Field';

/* A field officer flagging that what they found on the ground does not
   match the record — never edits the record directly, only files
   something for a reviewing officer to look at. Mirrors
   RespondObjectionModal/FileObjectionModal's shape. */
const TYPES = [
  'area_mismatch',
  'boundary_mismatch',
  'survey_number_mismatch',
  'ownership_mismatch',
  'land_use_mismatch',
  'missing_document',
  'other',
];

export default function DiscrepancyModal({ surveyTaskId, caseNumber, suggestedType, onClose, onDone }) {
  const [discrepancyType, setDiscrepancyType] = useState(suggestedType || TYPES[0]);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  const save = useMutation(() =>
    discrepanciesApi.create({ surveyTaskId, discrepancyType, description: description.trim() }),
  );

  async function onSave() {
    const result = validate(
      { description },
      { description: [required('Description'), minLength('Description', 10)] },
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
      title="Report a discrepancy"
      subtitle={caseNumber}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Filing…' : 'Submit discrepancy'}
          </Button>
        </>
      }
    >
      <Select
        label="Type"
        value={discrepancyType}
        options={TYPES.map((value) => ({ value, label: discrepancyTypeLabel(value) }))}
        onChange={(event) => setDiscrepancyType(event.target.value)}
      />

      <Textarea
        label="Description"
        value={description}
        error={errors.description}
        maxLength={2000}
        placeholder="What was found on the ground, and how it differs from the record."
        onChange={(event) => {
          setDescription(event.target.value);
          if (errors.description) setErrors({});
        }}
        hint="Creates a review task for the SLAO or District Officer — it does not change the record itself."
      />
    </Modal>
  );
}
