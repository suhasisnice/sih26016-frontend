import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import * as casesApi from '../api/cases';
import * as grievancesApi from '../api/grievances';
import { useApi, useMutation } from '../hooks/useApi';
import { useEnums } from '../hooks/useEnums';
import { grievanceCategoryLabel, roleLabel, stageLabel } from '../lib/labels';
import * as fmt from '../lib/format';
import { required, minLength, validate } from '../lib/validate';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { Select, Textarea } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import './objections.css';

/* Landowner Dashboard -> Raise Grievance -> Select Type -> Subject ->
   Description -> Attach (optional) -> Submit -> Grievance ID -> Track.

   The case a grievance is filed against is never a field the person types
   an id into — it is chosen from a dropdown built ONLY from cases GET
   /cases already scoped to this account (the same entitlement every other
   screen uses), so there is no case_id field here that could be edited to
   point at somebody else's case even before the backend's own check runs. */
export default function RaiseGrievance() {
  const navigate = useNavigate();
  const { grievance_categories: categories } = useEnums();

  const myCases = useApi((opts) => casesApi.list({ limit: 100 }, opts), []);

  const [caseId, setCaseId] = useState('');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactMethod, setContactMethod] = useState('sms');
  const [attachment, setAttachment] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);

  const submit = useMutation(() =>
    grievancesApi.file({
      caseId,
      category,
      subject: subject.trim(),
      description: description.trim(),
      preferredContactMethod: contactMethod,
      attachment,
    }),
  );

  async function onSubmit() {
    const result = validate(
      { caseId, category, subject, description },
      {
        caseId: [required('Case')],
        category: [required('Grievance type')],
        subject: [required('Subject'), minLength('Subject', 3)],
        description: [required('Description'), minLength('Description', 10)],
      },
    );
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      const result_ = await submit.run();
      setSubmitted(result_);
    } catch {
      /* useMutation holds it; rendered below the form. */
    }
  }

  if (myCases.loading) return <Loading label="Loading your acquisition cases" rows={4} />;
  if (myCases.error) return <ErrorState error={myCases.error} onRetry={myCases.reload} />;

  const cases = (myCases.data && myCases.data.items) || [];

  if (submitted) {
    return (
      <>
        <PageHeader
          back={{ to: '/grievances', label: 'My grievances' }}
          title="Grievance submitted"
        />
        <div className="objection-summary" style={{ textAlign: 'center', padding: 'var(--s6) var(--s4)' }}>
          <CheckCircle2 size={40} strokeWidth={1.75} color="var(--ok)" aria-hidden="true" />
          <p style={{ fontSize: 16, fontWeight: 600, margin: 'var(--s3) 0 var(--s5)' }}>
            Grievance submitted successfully
          </p>
        </div>
        <dl className="objection-facts">
          <div>
            <dt>Grievance ID</dt>
            <dd>{submitted.grievance_number}</dd>
          </div>
          <div>
            <dt>Case reference</dt>
            <dd>{submitted.case_number}</dd>
          </div>
          <div>
            <dt>Submitted on</dt>
            <dd>{fmt.date(submitted.filed_on)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Submitted</dd>
          </div>
          <div>
            <dt>Assigned to</dt>
            <dd>{roleLabel(submitted.assigned_role)}</dd>
          </div>
        </dl>
        <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s5)' }}>
          <Button variant="primary" onClick={() => navigate(`/grievances/${submitted.id}`)}>
            Track grievance
          </Button>
          <Button variant="quiet" onClick={() => navigate('/my-acquisition')}>
            Back to my acquisition
          </Button>
        </div>
      </>
    );
  }

  if (cases.length === 0) {
    return (
      <>
        <PageHeader back={{ to: '/grievances', label: 'My grievances' }} title="Raise a grievance" />
        <Empty
          center
          title="No acquisition case on file"
          body="A grievance can only be raised against a case recorded in your name. If you believe that is wrong, the district office holds the land records."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader back={{ to: '/grievances', label: 'My grievances' }} title="Raise a grievance" />

      <Select
        label="Grievance type *"
        value={category}
        error={errors.category}
        placeholder="Select"
        options={categories.map((value) => ({ value, label: grievanceCategoryLabel(value) }))}
        onChange={(event) => {
          setCategory(event.target.value);
          if (errors.category) setErrors((e) => ({ ...e, category: undefined }));
        }}
      />

      <Select
        label="Case reference *"
        value={caseId}
        error={errors.caseId}
        placeholder={cases.length > 1 ? 'Select your case' : undefined}
        options={cases.map((c) => ({
          value: String(c.id),
          label: `${c.case_number} — ${stageLabel(c.stage)}`,
        }))}
        onChange={(event) => {
          setCaseId(event.target.value);
          if (errors.caseId) setErrors((e) => ({ ...e, caseId: undefined }));
        }}
        hint="Automatically limited to acquisition cases recorded against your own land."
      />

      <label className="field">
        <span className="field__label">Subject *</span>
        <input
          type="text"
          className={`field__control${errors.subject ? ' is-invalid' : ''}`}
          value={subject}
          maxLength={200}
          placeholder="Short summary — e.g. Compensation amount seems incorrect"
          onChange={(event) => {
            setSubject(event.target.value);
            if (errors.subject) setErrors((e) => ({ ...e, subject: undefined }));
          }}
        />
        {errors.subject && (
          <span className="field__error" role="alert">
            {errors.subject}
          </span>
        )}
      </label>

      <Textarea
        label="Description *"
        value={description}
        error={errors.description}
        maxLength={2000}
        placeholder="Describe the issue in your own words — what happened, and what you expected instead."
        onChange={(event) => {
          setDescription(event.target.value);
          if (errors.description) setErrors((e) => ({ ...e, description: undefined }));
        }}
      />

      <label className="field">
        <span className="field__label">Supporting document</span>
        <input
          type="file"
          className="field__control"
          accept="application/pdf,image/jpeg,image/png,image/tiff"
          onChange={(event) => setAttachment(event.target.files ? event.target.files[0] : null)}
        />
        <span className="field__hint">Optional. A photo or PDF that supports your complaint.</span>
      </label>

      <Select
        label="Preferred contact method"
        value={contactMethod}
        options={[
          { value: 'sms', label: 'SMS' },
          { value: 'email', label: 'Email' },
          { value: 'both', label: 'SMS and email' },
        ]}
        onChange={(event) => setContactMethod(event.target.value)}
      />

      {submit.error && (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: 'var(--s3) 0' }}>
          {submit.error.message}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s5)' }}>
        <Button variant="primary" onClick={onSubmit} disabled={submit.pending}>
          {submit.pending ? 'Submitting…' : 'Submit grievance'}
        </Button>
        <Button variant="quiet" onClick={() => navigate(-1)} disabled={submit.pending}>
          Cancel
        </Button>
      </div>
    </>
  );
}
