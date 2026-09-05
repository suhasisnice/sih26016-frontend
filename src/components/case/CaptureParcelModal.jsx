import { useEffect, useState } from 'react';
import { Crosshair } from 'lucide-react';
import * as parcelsApi from '../../api/parcels';
import { useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import { parcelStatusLabel } from '../../lib/labels';
import { isNumber, required, surveyNumber, validate } from '../../lib/validate';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select } from '../ui/Field';

/* Register a parcel from the field.

   This is the screen the problem statement means when it says the officer is
   standing in a field with a phone rather than sitting at a desk. The backend
   has accepted POST /parcels for a while — with a gps_accuracy_m field, and
   with field_officer explicitly on the writer list — but nothing in the app
   ever called it, so the role that exists to collect this data had no way to
   enter any.

   Three things it does that a desk form would not:

   - **Takes the fix from the device**, not from two number inputs. Typing
     coordinates by hand is how a parcel ends up in the Bay of Bengal.
   - **Records how good the fix was.** A reading under tree cover is worth
     less than one in an open field, and a verification trail that cannot
     tell them apart is not much of a trail.
   - **Refuses a bad fix rather than rounding it off.** A phone with no lock
     reports (0, 0), which is in the Atlantic. */

/* Above this the reading is tower or wifi triangulation rather than a
   satellite fix, and storing it as a parcel corner would be filing a guess
   as a measurement. */
const MAX_ACCEPTABLE_ACCURACY_M = 100;

const GEOLOCATION_ERRORS = {
  1: 'Location permission was refused. Allow it for this site, then try again.',
  2: 'No position could be obtained. Move somewhere with a clearer view of the sky.',
  3: 'Timed out waiting for a fix. Stay still and try again.',
};

export default function CaptureParcelModal({ caseRecord, people, onClose, onDone }) {
  const { parcel_statuses: statuses } = useEnums();
  const save = useMutation((payload) => parcelsApi.create(payload));

  const [values, setValues] = useState({
    survey_number: '',
    ulpin: '',
    area_ha: '',
    owner_id: '',
    status: 'notified',
  });
  const [errors, setErrors] = useState({});
  const [fix, setFix] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(() => {
    // Ask on open. The officer opened this because they are standing on the
    // plot; making them press a button first is a step that exists only
    // because the form was written at a desk.
    if (supported) capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capture() {
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocating(false);
        if (latitude === 0 && longitude === 0) {
          setLocateError('The device reported (0, 0), which means it has no fix yet.');
          return;
        }
        setFix({ latitude, longitude, accuracy });
      },
      (err) => {
        setLocating(false);
        setLocateError(GEOLOCATION_ERRORS[err.code] || 'Could not read the device location.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  const tooLoose = Boolean(fix) && fix.accuracy > MAX_ACCEPTABLE_ACCURACY_M;
  const canSave = Boolean(fix) && !tooLoose && !save.pending;

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  async function onSave() {
    const result = validate(values, {
      survey_number: [required('Survey number'), surveyNumber('Survey number')],
      area_ha: [required('Area'), isNumber('Area')],
      owner_id: [required('Owner')],
    });
    setErrors(result.errors);
    if (!result.isValid || !canSave) return;

    try {
      await save.run({
        case_id: caseRecord.id,
        survey_number: values.survey_number.trim(),
        ulpin: values.ulpin.trim() || null,
        area_ha: Number(values.area_ha),
        owner_id: Number(values.owner_id),
        status: values.status,
        latitude: fix.latitude,
        longitude: fix.longitude,
        gps_accuracy_m: Math.round(fix.accuracy),
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
      title="Record a parcel here"
      subtitle={caseRecord.case_number}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={!canSave}>
            {save.pending ? 'Recording…' : 'Record parcel'}
          </Button>
        </>
      }
    >
      <div className={`fix${fix && !tooLoose ? ' is-good' : ''}${tooLoose ? ' is-bad' : ''}`}>
        <p className="fix__head">
          <Crosshair size={15} strokeWidth={1.75} aria-hidden="true" />
          Position from this device
        </p>

        {!supported && (
          <p className="fix__note is-error">
            This browser will not report a location, so a parcel cannot be geo-tagged
            from here. Use a device with location services.
          </p>
        )}

        {supported && locating && <p className="fix__note">Getting a fix…</p>}

        {supported && !locating && locateError && (
          <p className="fix__note is-error">{locateError}</p>
        )}

        {fix && (
          <>
            <p className="fix__coords">
              {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}
            </p>
            <p className={`fix__note${tooLoose ? ' is-error' : ''}`}>
              {tooLoose
                ? `Accurate to only about ${Math.round(fix.accuracy)} m — too loose to file.
                   Anything over ${MAX_ACCEPTABLE_ACCURACY_M} m is a network estimate rather
                   than a satellite fix.`
                : `Accurate to about ${Math.round(fix.accuracy)} m, recorded with the parcel.`}
            </p>
          </>
        )}

        {supported && !locating && (
          <Button variant="secondary" onClick={capture}>
            {fix ? 'Take the reading again' : 'Try again'}
          </Button>
        )}
      </div>

      <Input
        label="Survey number"
        value={values.survey_number}
        error={errors.survey_number}
        placeholder="142/3B"
        onChange={(event) => set('survey_number', event.target.value)}
      />

      <Input
        label="ULPIN (optional)"
        value={values.ulpin}
        maxLength={14}
        placeholder="14-character Bhu-Aadhaar, if one has been issued"
        onChange={(event) => set('ulpin', event.target.value.toUpperCase())}
      />

      <Input
        label="Area (hectares)"
        type="number"
        step="0.0001"
        min="0.0001"
        inputMode="decimal"
        value={values.area_ha}
        error={errors.area_ha}
        onChange={(event) => set('area_ha', event.target.value)}
        hint="As measured or as recorded on the RTC — whichever this reading is verifying."
      />

      <Select
        label="Owner"
        value={values.owner_id}
        error={errors.owner_id}
        placeholder="Choose the recorded holder"
        options={(people || []).map((person) => ({
          value: String(person.id),
          label: person.name,
        }))}
        onChange={(event) => set('owner_id', event.target.value)}
        hint="Only households already on this case. Add the household first if it is missing."
      />

      <Select
        label="Status"
        value={values.status}
        options={(statuses.length ? statuses : ['notified']).map((value) => ({
          value,
          label: parcelStatusLabel(value),
        }))}
        onChange={(event) => set('status', event.target.value)}
      />

      <p className="fix__hint">
        No boundary is filed. A phone gives a position, not a survey — the map draws
        this parcel as a point until a surveyed outline is attached.
      </p>
    </Modal>
  );
}
