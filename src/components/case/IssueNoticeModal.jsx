import { useState } from 'react';
import * as noticesApi from '../../api/notices';
import { useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import { noticeSection, noticeTypeLabel } from '../../lib/labels';
import { isNumber, minLength, notNegative, required, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select } from '../ui/Field';

/* Publishing a statutory instrument — Sections 11, 19, 23 and 38. This is
   what puts a case on the public notice board (GET /notices) and onto a
   subscribed landowner's WhatsApp or email; a case worked entirely through
   this screen has no other way to reach either.

   `availableTypes` is computed by the caller from the case's own stage and
   register, so a type that would 400 (too early, or already issued) is
   never offered in the first place — the same "never show a button the
   server will refuse" rule ProposalDetail follows for its own transitions. */
export default function IssueNoticeModal({ caseRecord, availableTypes, onClose, onDone }) {
  const { notice_types: allTypes } = useEnums();
  const types = availableTypes || allTypes || [];

  const [values, setValues] = useState({
    notice_type: types.length === 1 ? types[0] : '',
    section_reference: types.length === 1 ? noticeSection(types[0]) || '' : '',
    issuing_authority: '',
    gazette_number: '',
    issued_on: new Date().toISOString().slice(0, 10),
    beneficiary_count: '',
    total_amount: '',
  });
  const [errors, setErrors] = useState({});

  const save = useMutation((payload) => noticesApi.issue(payload));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  function onTypeChange(value) {
    setValues((current) => ({
      ...current,
      notice_type: value,
      // The section is a legal fact of the notice type, not something an
      // officer chooses — prefilled, and still editable for the rare case
      // where a state cites a different sub-section.
      section_reference: noticeSection(value) || current.section_reference,
    }));
    if (errors.notice_type) setErrors((current) => ({ ...current, notice_type: null }));
  }

  const isAward = values.notice_type === 'award';

  async function onSave() {
    const rules = {
      notice_type: [required('Notice type')],
      section_reference: [required('Section')],
      issuing_authority: [required('Issuing authority'), minLength('Issuing authority', 3)],
      issued_on: [required('Date issued')],
    };
    if (isAward) {
      rules.beneficiary_count = [isNumber('Beneficiary count'), notNegative('Beneficiary count')];
      rules.total_amount = [isNumber('Total amount'), notNegative('Total amount')];
    }
    const result = validate(values, rules);
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await save.run({
        case_id: caseRecord.id,
        notice_type: values.notice_type,
        section_reference: values.section_reference.trim(),
        issuing_authority: values.issuing_authority.trim(),
        gazette_number: values.gazette_number.trim() || null,
        issued_on: values.issued_on,
        beneficiary_count: isAward && values.beneficiary_count !== '' ? Number(values.beneficiary_count) : null,
        total_amount: isAward && values.total_amount !== '' ? Number(values.total_amount) : null,
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
      title="Issue a statutory notice"
      subtitle={caseRecord.case_number}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Publishing…' : 'Publish notice'}
          </Button>
        </>
      }
    >
      {types.length === 0 ? (
        <p className="field__hint">
          Every instrument this case's current stage allows has already been issued.
        </p>
      ) : (
        <>
          <Select
            label="Instrument"
            value={values.notice_type}
            error={errors.notice_type}
            placeholder="Choose which notice this is"
            options={types.map((value) => ({ value, label: noticeTypeLabel(value) }))}
            onChange={(event) => onTypeChange(event.target.value)}
          />
          <Input
            label="Section"
            value={values.section_reference}
            error={errors.section_reference}
            maxLength={40}
            onChange={(event) => set('section_reference', event.target.value)}
          />
          <Input
            label="Issuing authority"
            value={values.issuing_authority}
            error={errors.issuing_authority}
            maxLength={160}
            placeholder="e.g. District Collector, Nashik"
            onChange={(event) => set('issuing_authority', event.target.value)}
          />
          <Input
            label="Gazette number (optional)"
            value={values.gazette_number}
            maxLength={60}
            onChange={(event) => set('gazette_number', event.target.value)}
          />
          <Input
            label="Issued on"
            type="date"
            value={values.issued_on}
            error={errors.issued_on}
            onChange={(event) => set('issued_on', event.target.value)}
          />
          {isAward && (
            <>
              <Input
                label="Beneficiaries (optional)"
                value={values.beneficiary_count}
                error={errors.beneficiary_count}
                inputMode="numeric"
                onChange={(event) => set('beneficiary_count', event.target.value)}
              />
              <Input
                label="Total amount (₹, optional)"
                value={values.total_amount}
                error={errors.total_amount}
                inputMode="numeric"
                onChange={(event) => set('total_amount', event.target.value)}
                hint="What the dashboard's 'awards declared' figure sums."
              />
            </>
          )}
          <p className="field__hint">
            Publishing notifies every landowner already subscribed on this case's parcels, and
            puts this case on the public notice board.
          </p>
        </>
      )}
    </Modal>
  );
}
