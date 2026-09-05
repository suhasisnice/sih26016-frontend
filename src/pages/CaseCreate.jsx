import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as casesApi from '../api/cases';
import * as referenceApi from '../api/reference';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { minLength, required, validate } from '../lib/validate';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import ErrorState from '../components/states/ErrorState';
import './casecreate.css';

/* Open a new acquisition file.

   A case always starts at preliminary notification — that is the first step
   the Act allows and there is no field to choose otherwise. District is not
   asked for either: it is derived from the village on the server, so the two
   can never contradict each other. */
export default function CaseCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [values, setValues] = useState({ title: '', project_id: '', village_id: '' });
  const [errors, setErrors] = useState({});

  const districtId = user && user.district_id ? user.district_id : undefined;
  const projects = useApi((opts) => referenceApi.projects(districtId, opts), [districtId]);
  const villages = useApi((opts) => referenceApi.villages(districtId, opts), [districtId]);

  const create = useMutation((payload) => casesApi.create(payload));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSubmit(event) {
    event.preventDefault();

    const result = validate(values, {
      title: [required('Title'), minLength('Title', 3)],
      project_id: [required('Project')],
      village_id: [required('Village')],
    });
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      const created = await create.run({
        title: values.title.trim(),
        project_id: Number(values.project_id),
        village_id: Number(values.village_id),
      });
      navigate(`/cases/${created.id}`, { replace: true });
    } catch {
      /* useMutation holds it; the form renders it below. */
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/cases', label: 'All cases' }}
        title="Open a new case"
        subtitle="The file opens at preliminary notification under Section 11. Every later stage is reached by advancing it, never by editing."
      />

      <form className="create-form" onSubmit={onSubmit} noValidate>
        {create.error && <ErrorState error={create.error} title="The case was not created" />}

        <Input
          label="Title"
          value={values.title}
          error={errors.title}
          placeholder="Acquisition for the Nashik–Sinnar four-laning, Package 3"
          onChange={(event) => set('title', event.target.value)}
          hint="What this acquisition is, in the words the file will be known by."
        />

        <Select
          label="Project"
          value={values.project_id}
          error={errors.project_id}
          placeholder={projects.loading ? 'Loading projects…' : 'Choose the project'}
          options={(projects.data || []).map((p) => ({
            value: String(p.id),
            label: `${p.name} — ${p.requiring_body}`,
          }))}
          onChange={(event) => set('project_id', event.target.value)}
          hint="The requiring body is the authority the land is being acquired for."
        />

        <Select
          label="Village"
          value={values.village_id}
          error={errors.village_id}
          placeholder={villages.loading ? 'Loading villages…' : 'Choose the village'}
          options={(villages.data || []).map((v) => ({ value: String(v.id), label: v.name }))}
          onChange={(event) => set('village_id', event.target.value)}
          hint="The district follows from the village and is not asked for separately."
        />

        <div className="create-form__actions">
          <Button type="submit" variant="primary" disabled={create.pending}>
            {create.pending ? 'Opening…' : 'Open the case'}
          </Button>
          <Button variant="quiet" to="/cases">
            Cancel
          </Button>
        </div>

        <p className="create-form__note">
          Parcels, affected households and documents are added to the case once it
          exists. A case number is issued automatically in the district series.
        </p>
      </form>
    </>
  );
}
