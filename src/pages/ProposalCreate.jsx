import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as proposalsApi from '../api/proposals';
import * as referenceApi from '../api/reference';
import { useApi, useMutation } from '../hooks/useApi';
import { isNumber, minLength, notNegative, required, validate } from '../lib/validate';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Field';
import ErrorState from '../components/states/ErrorState';
import './casecreate.css';

/* Open a proposal — the first document in the chain, before any case exists.

   District is asked for and then thrown away. It is not part of the payload:
   the server derives district and state from the village, so the three can
   never contradict each other. It is on the form because a list of every
   village in four states is not a thing anyone can choose from. */
export default function ProposalCreate() {
  const navigate = useNavigate();

  const [values, setValues] = useState({
    title: '',
    purpose: '',
    district_id: '',
    village_id: '',
    estimated_area_ha: '',
    estimated_families: '',
    estimated_cost: '',
  });
  const [errors, setErrors] = useState({});

  const districts = useApi((opts) => referenceApi.districts(undefined, opts), []);
  const villages = useApi(
    (opts) => referenceApi.villages(values.district_id || undefined, opts),
    [values.district_id],
    { skip: !values.district_id },
  );

  const create = useMutation((payload) => proposalsApi.create(payload));

  function set(field, value) {
    setValues((current) => {
      // Changing district invalidates the village chosen under the old one.
      if (field === 'district_id') return { ...current, district_id: value, village_id: '' };
      return { ...current, [field]: value };
    });
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSubmit(event) {
    event.preventDefault();

    const result = validate(values, {
      title: [required('Title'), minLength('Title', 5)],
      /* The server's floor is 20 characters. Asked for here as a sentence
         rather than a character count, because "purpose must be at least 20
         characters" is a database talking, not an office. */
      purpose: [required('Purpose'), minLength('Purpose', 20)],
      district_id: [required('District')],
      village_id: [required('Village')],
      estimated_area_ha: [required('Estimated area'), isNumber('Estimated area')],
      estimated_families: [isNumber('Families'), notNegative('Families')],
      estimated_cost: [isNumber('Estimated cost'), notNegative('Estimated cost')],
    });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      const created = await create.run({
        title: values.title.trim(),
        purpose: values.purpose.trim(),
        village_id: Number(values.village_id),
        estimated_area_ha: Number(values.estimated_area_ha),
        estimated_families:
          values.estimated_families === '' ? null : Number(values.estimated_families),
        estimated_cost: values.estimated_cost === '' ? null : Number(values.estimated_cost),
      });
      navigate(`/proposals/${created.id}`, { replace: true });
    } catch {
      /* useMutation holds it; the form renders it below. */
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/proposals', label: 'All proposals' }}
        title="Open a proposal"
        subtitle="It opens as a draft held by your office. Nothing reaches the state until you submit it."
      />

      <form className="create-form" onSubmit={onSubmit} noValidate>
        {create.error && <ErrorState error={create.error} title="The proposal was not opened" />}

        <Input
          label="Title"
          value={values.title}
          error={errors.title}
          placeholder="Land for the Nashik–Sinnar four-laning, Package 3"
          onChange={(event) => set('title', event.target.value)}
          hint="What is being asked for, in the words the file will be known by."
        />

        <Textarea
          label="Purpose"
          value={values.purpose}
          error={errors.purpose}
          rows={5}
          onChange={(event) => set('purpose', event.target.value)}
          hint="Why the land is needed and what will be built on it. The state reads this first, and returns proposals that do not answer it."
        />

        <Select
          label="District"
          value={values.district_id}
          error={errors.district_id}
          placeholder={districts.loading ? 'Loading districts…' : 'Choose the district'}
          options={(districts.data || []).map((d) => ({ value: String(d.id), label: d.name }))}
          onChange={(event) => set('district_id', event.target.value)}
        />

        <Select
          label="Village"
          value={values.village_id}
          error={errors.village_id}
          disabled={!values.district_id}
          placeholder={
            !values.district_id
              ? 'Choose a district first'
              : villages.loading
                ? 'Loading villages…'
                : 'Choose the village'
          }
          options={(villages.data || []).map((v) => ({ value: String(v.id), label: v.name }))}
          onChange={(event) => set('village_id', event.target.value)}
          hint="The district and state follow from the village and are not stored separately."
        />

        <Input
          label="Estimated area (hectares)"
          value={values.estimated_area_ha}
          error={errors.estimated_area_ha}
          inputMode="decimal"
          placeholder="12.40"
          onChange={(event) => set('estimated_area_ha', event.target.value)}
        />

        <Input
          label="Families likely affected"
          value={values.estimated_families}
          error={errors.estimated_families}
          inputMode="numeric"
          placeholder="34"
          onChange={(event) => set('estimated_families', event.target.value)}
          hint="An estimate at this stage. The real count comes from the social impact assessment."
        />

        <Input
          label="Estimated cost (₹)"
          value={values.estimated_cost}
          error={errors.estimated_cost}
          inputMode="numeric"
          placeholder="48261900"
          onChange={(event) => set('estimated_cost', event.target.value)}
          hint="Whole rupees, compensation and R&R together."
        />

        <div className="create-form__actions">
          <Button type="submit" variant="primary" disabled={create.pending}>
            {create.pending ? 'Opening…' : 'Open the draft'}
          </Button>
          <Button variant="quiet" to="/proposals">
            Cancel
          </Button>
        </div>

        <p className="create-form__note">
          A draft can be edited and resubmitted as often as it needs to be. Only on
          central sanction does an acquisition case come into existence, and from
          that point the statutory clock is running.
        </p>
      </form>
    </>
  );
}
