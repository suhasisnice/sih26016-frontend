import { useState } from 'react';
import * as personsApi from '../../api/persons';
import { useApi, useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import { benefitCategoryLabel, benefitDeliveryStatusLabel } from '../../lib/labels';
import { maxLength, required, validate } from '../../lib/validate';
import * as fmt from '../../lib/format';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import StatusBadge from './StatusBadge';
import ProvenanceBadge from './ProvenanceBadge';
import { Input, Select, Textarea } from '../ui/Field';
import Loading from '../states/Loading';
import ErrorState from '../states/ErrorState';
import Empty from '../states/Empty';

const NOTE_REQUIRED_STATUSES = new Set(['failed', 'review_required']);

/* The itemised breakdown under one household's R&R record. RnRRecord.status
   stays the one overall status the rest of the app reads; this modal is the
   only place that touches the benefits underneath it, one at a time, since
   "R&R completed" without saying which of several promised benefits actually
   arrived is not something anyone here can act on. */
export default function RnrBenefitsModal({ person, canManage, onClose, onChanged }) {
  const rnrId = person.rnr.id;
  const { benefit_categories: categories, benefit_delivery_statuses: deliveryStatuses } = useEnums();
  const benefits = useApi((opts) => personsApi.rnrBenefits(rnrId, opts), [rnrId]);

  const [mode, setMode] = useState('list');
  const [editing, setEditing] = useState(null);

  const [addValues, setAddValues] = useState({
    category: '',
    description: '',
    responsible_department: '',
    expected_on: '',
  });
  const [editValues, setEditValues] = useState({ delivery_status: '', note: '', approved_on: '', expected_on: '' });
  const [errors, setErrors] = useState({});

  const create = useMutation((payload) => personsApi.createRnrBenefit(rnrId, payload));
  const update = useMutation((benefitId, payload) => personsApi.updateRnrBenefit(benefitId, payload));

  function startAdd() {
    setAddValues({ category: categories[0] || 'housing', description: '', responsible_department: '', expected_on: '' });
    setErrors({});
    setMode('add');
  }

  function startEdit(benefit) {
    setEditing(benefit);
    setEditValues({
      delivery_status: benefit.delivery_status,
      note: benefit.note || '',
      approved_on: benefit.approved_on || '',
      expected_on: benefit.expected_on || '',
    });
    setErrors({});
    setMode('edit');
  }

  function backToList() {
    setMode('list');
    create.reset();
    update.reset();
  }

  async function onSaveAdd() {
    const result = validate(addValues, {
      category: [required('Category')],
      description: [maxLength('Description', 200)],
      responsible_department: [maxLength('Responsible department', 120)],
    });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await create.run({
        category: addValues.category,
        description: addValues.description.trim() || null,
        responsible_department: addValues.responsible_department.trim() || null,
        expected_on: addValues.expected_on || null,
      });
      benefits.reload();
      onChanged?.();
      setMode('list');
    } catch {
      /* create.error already carries the message to show */
    }
  }

  async function onSaveEdit() {
    const noteRequired = NOTE_REQUIRED_STATUSES.has(editValues.delivery_status);
    const result = validate(editValues, {
      note: noteRequired ? [required('Note'), maxLength('Note', 500)] : [maxLength('Note', 500)],
    });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      await update.run(editing.id, {
        delivery_status: editValues.delivery_status,
        note: editValues.note.trim() || null,
        approved_on: editValues.approved_on || null,
        expected_on: editValues.expected_on || null,
      });
      benefits.reload();
      onChanged?.();
      setMode('list');
    } catch {
      /* update.error already carries the message to show */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={create.pending || update.pending}
      error={mode === 'add' ? create.error : mode === 'edit' ? update.error : null}
      title="R&R benefits"
      subtitle={
        <>
          {person.name} <ProvenanceBadge provenance={person.provenance} />
        </>
      }
      footer={
        mode === 'list' ? (
          <>
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
            {canManage && (
              <Button variant="primary" onClick={startAdd}>
                Add benefit
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="quiet" onClick={backToList} disabled={create.pending || update.pending}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={mode === 'add' ? onSaveAdd : onSaveEdit}
              disabled={create.pending || update.pending}
            >
              {create.pending || update.pending ? 'Saving…' : 'Save'}
            </Button>
          </>
        )
      }
    >
      {mode === 'list' && (
        <>
          {benefits.loading && <Loading inline rows={2} />}
          {benefits.error && <ErrorState error={benefits.error} onRetry={benefits.reload} />}
          {benefits.data && benefits.data.length === 0 && (
            <Empty
              title="No benefits recorded yet"
              body="Add each benefit this household is entitled to — housing, land, employment, annuity — and track it to delivery on its own."
            />
          )}
          {benefits.data && benefits.data.length > 0 && (
            <div className="benefit-list">
              {benefits.data.map((b) => (
                <div key={b.id} className="benefit-row">
                  <div className="benefit-row__head">
                    <span className="benefit-row__category">{benefitCategoryLabel(b.category)}</span>
                    <StatusBadge kind="benefitDelivery" value={b.delivery_status} />
                  </div>
                  {b.description && <p className="benefit-row__desc">{b.description}</p>}
                  <div className="benefit-row__meta">
                    {b.responsible_department && <span>{b.responsible_department}</span>}
                    {b.expected_on && <span>Expected {fmt.date(b.expected_on)}</span>}
                    {b.approved_on && <span>Approved {fmt.date(b.approved_on)}</span>}
                  </div>
                  {b.note && <p className="benefit-row__note">{b.note}</p>}
                  {canManage && (
                    <Button variant="link" onClick={() => startEdit(b)}>
                      Update
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'add' && (
        <>
          <Select
            label="Category"
            value={addValues.category}
            options={(categories.length ? categories : ['housing']).map((value) => ({
              value,
              label: benefitCategoryLabel(value),
            }))}
            onChange={(event) => setAddValues((v) => ({ ...v, category: event.target.value }))}
          />
          <Textarea
            label="Description"
            value={addValues.description}
            error={errors.description}
            maxLength={200}
            placeholder="2BHK relocation flat, Sector 4 rehabilitation colony"
            onChange={(event) => setAddValues((v) => ({ ...v, description: event.target.value }))}
            hint="Optional for most categories — required in practice for Other."
          />
          <Input
            label="Responsible department (optional)"
            value={addValues.responsible_department}
            error={errors.responsible_department}
            maxLength={120}
            placeholder="Housing Board"
            onChange={(event) => setAddValues((v) => ({ ...v, responsible_department: event.target.value }))}
          />
          <Input
            label="Expected on (optional)"
            type="date"
            value={addValues.expected_on}
            onChange={(event) => setAddValues((v) => ({ ...v, expected_on: event.target.value }))}
          />
        </>
      )}

      {mode === 'edit' && editing && (
        <>
          <p className="benefit-row__meta">{benefitCategoryLabel(editing.category)}</p>
          <Select
            label="Delivery status"
            value={editValues.delivery_status}
            options={(deliveryStatuses.length ? deliveryStatuses : [editing.delivery_status]).map((value) => ({
              value,
              label: benefitDeliveryStatusLabel(value),
            }))}
            onChange={(event) => setEditValues((v) => ({ ...v, delivery_status: event.target.value }))}
          />
          <Input
            label="Approved on (optional)"
            type="date"
            value={editValues.approved_on}
            onChange={(event) => setEditValues((v) => ({ ...v, approved_on: event.target.value }))}
          />
          <Input
            label="Expected on (optional)"
            type="date"
            value={editValues.expected_on}
            onChange={(event) => setEditValues((v) => ({ ...v, expected_on: event.target.value }))}
          />
          <Textarea
            label={NOTE_REQUIRED_STATUSES.has(editValues.delivery_status) ? 'Note (required)' : 'Note (optional)'}
            value={editValues.note}
            error={errors.note}
            maxLength={500}
            placeholder="What went wrong, or what still needs review."
            onChange={(event) => setEditValues((v) => ({ ...v, note: event.target.value }))}
          />
        </>
      )}
    </Modal>
  );
}
