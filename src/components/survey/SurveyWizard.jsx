import { useEffect, useRef, useState } from 'react';
import { Crosshair, X } from 'lucide-react';
import * as surveyApi from '../../api/survey';
import * as parcelsApi from '../../api/parcels';
import * as documentsApi from '../../api/documents';
import { api } from '../../api/client';
import { useApi, useMutation } from '../../hooks/useApi';
import { useGeolocation } from '../../hooks/useGeolocation';
import * as fmt from '../../lib/format';
import {
  boundaryConditionLabel,
  landUseTypeLabel,
  physicalFeatureLabel,
  surveyPhotoCategoryLabel,
} from '../../lib/labels';
import { compressImage } from '../../lib/imageCompress';
import { loadDraft, saveDraft, clearDraft } from '../../lib/surveyDraft';
import StepIndicator from './StepIndicator';
import StepUpConfirmModal from '../case/StepUpConfirmModal';
import DiscrepancyModal from '../case/DiscrepancyModal';
import UploadDocumentModal from '../case/UploadDocumentModal';
import Button from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import Loading from '../states/Loading';
import ErrorState from '../states/ErrorState';
import './wizard.css';

const MIN_BOUNDARY_CORNERS = 3;
const AREA_DISCREPANCY_THRESHOLD = 0.05; // 5% difference prompts a flag
const PHYSICAL_FEATURES = ['building', 'road', 'water_body', 'trees_crops', 'utility', 'other'];
const PHOTO_CATEGORIES = [
  'land_parcel', 'boundary', 'existing_structure', 'crop_land_use',
  'road_access', 'nearby_structure', 'survey_marker', 'other',
];
const LAND_USES = ['agricultural', 'residential', 'commercial', 'industrial', 'vacant', 'other'];
const BOUNDARY_CONDITIONS = ['verified', 'partially_verified', 'not_clearly_identifiable'];

const STEPS = [
  { key: 'land', label: 'Land' },
  { key: 'person', label: 'Person' },
  { key: 'location', label: 'Location' },
  { key: 'measurement', label: 'Measurement' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'observations', label: 'Observations' },
  { key: 'review', label: 'Review' },
];

/* The mobile field-data-entry wizard — the whole point of this build.
   One long scroll (the old SurveyEntryForm) turned into seven small steps,
   each small enough to complete one-handed. State lives here, once, and
   each step below is a plain presentational slice of it — CLAUDE.md
   "prefer boring", not seven components each managing their own copy of
   the same survey. */
export default function SurveyWizard({ task: t, onChanged }) {
  const [step, setStep] = useState(0);

  const [areaInput, setAreaInput] = useState(t.measured_area_ha != null ? String(t.measured_area_ha) : '');
  const [remarksInput, setRemarksInput] = useState(t.remarks || '');
  const [corners, setCorners] = useState([]);
  const [landUse, setLandUse] = useState(t.land_use || '');
  const [boundaryCondition, setBoundaryCondition] = useState(t.boundary_condition || '');
  const [physicalFeatures, setPhysicalFeatures] = useState(t.physical_features || []);
  const [boundaryDiscrepancyFlag, setBoundaryDiscrepancyFlag] = useState(
    (t.checklist && t.checklist.boundary_discrepancy_found) || false,
  );
  const [onSitePersonName, setOnSitePersonName] = useState(t.on_site_person_name || '');
  const [onSitePersonRelation, setOnSitePersonRelation] = useState(t.on_site_person_relation || '');
  const [personVerified, setPersonVerified] = useState(t.person_verified || false);
  const [personVerificationNote, setPersonVerificationNote] = useState(t.person_verification_note || '');
  const [showOnSitePersonFields, setShowOnSitePersonFields] = useState(Boolean(t.on_site_person_name));

  const [photoCategory, setPhotoCategory] = useState('land_parcel');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [discrepancyOpen, setDiscrepancyOpen] = useState(null); // null | suggested type string
  const [stepupOpen, setStepupOpen] = useState(false);
  const [demoFix, setDemoFix] = useState(null);

  const [saveError, setSaveError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine);

  const location = useGeolocation();
  const corner = useGeolocation();
  const save = useMutation((payload) => surveyApi.save(t.id, payload));
  const submit = useMutation((token) => surveyApi.submit(t.id, token));
  const uploadPhoto = useMutation((payload) => surveyApi.uploadPhoto(payload));
  const fileInputRef = useRef(null);

  const parcel = useApi((opts) => parcelsApi.get(t.parcel_id, opts), [t.parcel_id], { skip: !t.parcel_id });
  const surveyDocs = useApi((opts) => documentsApi.forSurveyTask(t.case_id, t.id, opts), [t.id]);

  // Restore a local draft (if one is newer than what's on the server) once,
  // on mount — never overwrites what the officer types after that.
  useEffect(() => {
    const draft = loadDraft(t.id);
    if (!draft) return;
    if (draft.areaInput !== undefined) setAreaInput(draft.areaInput);
    if (draft.remarksInput !== undefined) setRemarksInput(draft.remarksInput);
    if (draft.landUse !== undefined) setLandUse(draft.landUse);
    if (draft.boundaryCondition !== undefined) setBoundaryCondition(draft.boundaryCondition);
    if (draft.physicalFeatures !== undefined) setPhysicalFeatures(draft.physicalFeatures);
    if (draft.onSitePersonName !== undefined) {
      setOnSitePersonName(draft.onSitePersonName);
      if (draft.onSitePersonName) setShowOnSitePersonFields(true);
    }
    if (draft.onSitePersonRelation !== undefined) setOnSitePersonRelation(draft.onSitePersonRelation);
    if (draft.personVerified !== undefined) setPersonVerified(draft.personVerified);
    if (draft.personVerificationNote !== undefined) setPersonVerificationNote(draft.personVerificationNote);
    if (draft.step !== undefined) setStep(draft.step);
    setDraftRestoredAt(draft.savedAt);
  }, [t.id]);

  // Mirror to localStorage on every change, debounced — the local draft,
  // not a network call.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(t.id, {
        step, areaInput, remarksInput, landUse, boundaryCondition, physicalFeatures,
        onSitePersonName, onSitePersonRelation, personVerified, personVerificationNote,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [
    t.id, step, areaInput, remarksInput, landUse, boundaryCondition, physicalFeatures,
    onSitePersonName, onSitePersonRelation, personVerified, personVerificationNote,
  ]);

  useEffect(() => {
    function goOnline() { setOnline(true); }
    function goOffline() { setOnline(false); }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  async function persistAll() {
    if (!online) {
      const err = new Error('Offline — saved locally, will sync when back online.');
      err.isOffline = true;
      throw err;
    }
    const payload = {
      remarks: remarksInput.trim() || null,
      land_use: landUse || null,
      boundary_condition: boundaryCondition || null,
      physical_features: physicalFeatures.length ? physicalFeatures : null,
      checklist: { boundary_discrepancy_found: boundaryDiscrepancyFlag },
      on_site_person_name: onSitePersonName.trim() || null,
      on_site_person_relation: onSitePersonRelation.trim() || null,
      person_verified: personVerified,
      person_verification_note: personVerificationNote.trim() || null,
    };
    if (areaInput.trim() !== '') payload.measured_area_ha = Number(areaInput);
    if (corners.length >= MIN_BOUNDARY_CORNERS) payload.boundary_points = corners;
    const updated = await save.run(payload);
    setCorners([]);
    setLastSyncedAt(new Date());
    return updated;
  }

  async function onSaveProgress() {
    setSaveError(null);
    try {
      await persistAll();
      onChanged();
    } catch (err) {
      if (!err.isOffline) setSaveError(err);
    }
  }

  async function onUseLocation() {
    try {
      const fix = await location.capture();
      setDemoFix(null);
      if (online) {
        await save.run({ location: { latitude: fix.latitude, longitude: fix.longitude } });
        setLastSyncedAt(new Date());
        onChanged();
      }
    } catch {
      /* location.error / save.error render below */
    }
  }

  async function onUseDemoLocation() {
    const fix = { latitude: 12.9716, longitude: 77.5946, accuracy: 5, isDemo: true };
    setDemoFix(fix);
    if (online) {
      try {
        await save.run({ location: { latitude: fix.latitude, longitude: fix.longitude } });
        setLastSyncedAt(new Date());
        onChanged();
      } catch (err) {
        setSaveError(err);
      }
    }
  }

  async function onAddCorner() {
    try {
      const fix = await corner.capture();
      setCorners((current) => [...current, { latitude: fix.latitude, longitude: fix.longitude }]);
    } catch {
      /* corner.error renders below */
    }
  }

  function onClearCorners() {
    setCorners([]);
  }

  function onTogglePhysicalFeature(feature) {
    setPhysicalFeatures((current) =>
      current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature],
    );
  }

  async function onPickPhotos(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length === 0) return;
    if (!online) {
      setSaveError(new Error('Photos need a connection to upload. They will stay in the picker until you retry.'));
      return;
    }

    let fix = location.fix || demoFix;
    if (!fix) {
      try {
        fix = await location.capture();
      } catch {
        fix = null;
      }
    }

    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        await uploadPhoto.run({
          taskId: t.id,
          file: compressed,
          latitude: fix ? fix.latitude : null,
          longitude: fix ? fix.longitude : null,
          category: photoCategory,
        });
      } catch {
        break;
      }
    }
    onChanged();
  }

  async function onDeletePhoto(photoId) {
    try {
      await surveyApi.deletePhoto(t.id, photoId);
      onChanged();
    } catch {
      /* swallowed — the photo list simply won't shrink, visible enough */
    }
  }

  const canSubmit =
    areaInput.trim() !== '' || t.measured_area_ha != null ||
    corners.length >= MIN_BOUNDARY_CORNERS || t.boundary_point_count >= MIN_BOUNDARY_CORNERS ||
    t.photos.length > 0;

  async function onVerifiedSubmit(stepupToken) {
    setStepupOpen(false);
    setSubmitError(null);
    try {
      await persistAll();
      await submit.run(stepupToken);
      clearDraft(t.id);
      onChanged();
    } catch (err) {
      setSubmitError(err);
    }
  }

  const recordedAreaHa = parcel.data ? parcel.data.area_ha : null;
  const measuredAreaHa = areaInput.trim() !== '' ? Number(areaInput) : t.measured_area_ha;
  const areaDiff =
    recordedAreaHa != null && measuredAreaHa != null ? measuredAreaHa - recordedAreaHa : null;
  const areaDiffPct =
    areaDiff != null && recordedAreaHa > 0 ? Math.abs(areaDiff) / recordedAreaHa : null;
  const showAreaDiscrepancyPrompt = areaDiffPct != null && areaDiffPct > AREA_DISCREPANCY_THRESHOLD;

  const docCount = surveyDocs.data ? surveyDocs.data.total : 0;
  const checklist = [
    { group: 'Land identification', key: 'survey_number', label: 'Survey number verified', done: Boolean(t.parcel_survey_number) },
    { group: 'Land identification', key: 'ulpin', label: 'ULPIN verified', done: Boolean(parcel.data && parcel.data.ulpin) },
    { group: 'Land identification', key: 'village', label: 'Village verified', done: Boolean(t.village_name) },
    { group: 'Area', key: 'recorded_area', label: 'Recorded area checked', done: recordedAreaHa != null },
    { group: 'Area', key: 'measurement', label: 'Field measurement completed', done: measuredAreaHa != null },
    {
      group: 'Boundary', key: 'boundary_inspected', label: 'Boundary inspected',
      done: t.boundary_point_count >= MIN_BOUNDARY_CORNERS || corners.length >= MIN_BOUNDARY_CORNERS || Boolean(boundaryCondition),
    },
    {
      group: 'Boundary', key: 'boundary_discrepancy_found', label: 'Boundary discrepancy found',
      done: boundaryDiscrepancyFlag, manual: true,
    },
    { group: 'Evidence', key: 'photos', label: 'Photographs captured', done: t.photos.length > 0 },
    { group: 'Evidence', key: 'documents', label: 'Supporting document uploaded', done: docCount > 0 },
    { group: 'Location', key: 'gps', label: 'GPS captured', done: t.has_location || Boolean(location.fix) || Boolean(demoFix) },
  ];

  function goNext() {
    onSaveProgress();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  return (
    <>
      {!online && (
        <div className="wizard-offline">
          <span>Offline — changes are saved on this device and will sync once you're back online.</span>
        </div>
      )}
      {draftRestoredAt && (
        <p className="wizard-draft-note">Restored a draft saved {fmt.dateTime(draftRestoredAt)}.</p>
      )}

      <StepIndicator steps={STEPS} currentIndex={step} />

      <div className="wizard-step">
        {STEPS[step].key === 'land' && <StepLand t={t} parcel={parcel} />}

        {STEPS[step].key === 'person' && (
          <StepPerson
            parcel={parcel}
            showOnSitePersonFields={showOnSitePersonFields}
            setShowOnSitePersonFields={setShowOnSitePersonFields}
            onSitePersonName={onSitePersonName}
            setOnSitePersonName={setOnSitePersonName}
            onSitePersonRelation={onSitePersonRelation}
            setOnSitePersonRelation={setOnSitePersonRelation}
            personVerified={personVerified}
            setPersonVerified={setPersonVerified}
            personVerificationNote={personVerificationNote}
            setPersonVerificationNote={setPersonVerificationNote}
          />
        )}

        {STEPS[step].key === 'location' && (
          <StepLocation
            t={t}
            location={location}
            demoFix={demoFix}
            onUseLocation={onUseLocation}
            onUseDemoLocation={onUseDemoLocation}
          />
        )}

        {STEPS[step].key === 'measurement' && (
          <StepMeasurement
            t={t}
            areaInput={areaInput}
            setAreaInput={setAreaInput}
            recordedAreaHa={recordedAreaHa}
            areaDiff={areaDiff}
            areaDiffPct={areaDiffPct}
            showAreaDiscrepancyPrompt={showAreaDiscrepancyPrompt}
            onFlagDiscrepancy={() => setDiscrepancyOpen('area_mismatch')}
            corner={corner}
            corners={corners}
            onAddCorner={onAddCorner}
            onClearCorners={onClearCorners}
          />
        )}

        {STEPS[step].key === 'evidence' && (
          <StepEvidence
            t={t}
            uploadPhoto={uploadPhoto}
            photoCategory={photoCategory}
            setPhotoCategory={setPhotoCategory}
            fileInputRef={fileInputRef}
            onPickPhotos={onPickPhotos}
            onDeletePhoto={onDeletePhoto}
            surveyDocs={surveyDocs}
            onUpload={() => setUploadOpen(true)}
          />
        )}

        {STEPS[step].key === 'observations' && (
          <StepObservations
            landUse={landUse}
            setLandUse={setLandUse}
            boundaryCondition={boundaryCondition}
            setBoundaryCondition={setBoundaryCondition}
            physicalFeatures={physicalFeatures}
            onToggleFeature={onTogglePhysicalFeature}
            remarksInput={remarksInput}
            setRemarksInput={setRemarksInput}
            checklist={checklist}
            boundaryDiscrepancyFlag={boundaryDiscrepancyFlag}
            onToggleBoundaryDiscrepancy={() => setBoundaryDiscrepancyFlag((v) => !v)}
            onFlagDiscrepancy={() => setDiscrepancyOpen('boundary_mismatch')}
          />
        )}

        {STEPS[step].key === 'review' && (
          <StepReview
            t={t}
            parcel={parcel}
            areaInput={areaInput}
            landUse={landUse}
            boundaryCondition={boundaryCondition}
            physicalFeatures={physicalFeatures}
            remarksInput={remarksInput}
            onSitePersonName={onSitePersonName}
            onSitePersonRelation={onSitePersonRelation}
            personVerified={personVerified}
            checklist={checklist}
            hasLocation={t.has_location || Boolean(location.fix) || Boolean(demoFix)}
          />
        )}
      </div>

      {saveError && <ErrorState error={saveError} title="Could not save" />}
      {submitError && <ErrorState error={submitError} title="Could not submit" />}
      {!saveError && lastSyncedAt && (
        <p className="wizard-draft-note">Synced to server {fmt.dateTime(lastSyncedAt)}</p>
      )}

      <div className="wizard-actions">
        {step > 0 && (
          <Button variant="quiet" className="wizard-btn" onClick={goBack}>
            Back
          </Button>
        )}
        <Button variant="secondary" className="wizard-btn" onClick={onSaveProgress} disabled={save.pending}>
          {save.pending ? 'Saving…' : 'Save draft'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" className="wizard-btn wizard-actions__primary" onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button
            variant="primary"
            className="wizard-btn wizard-actions__primary"
            onClick={() => setStepupOpen(true)}
            disabled={submit.pending || !canSubmit || !online}
          >
            {submit.pending ? 'Submitting…' : 'Submit report'}
          </Button>
        )}
      </div>

      {uploadOpen && (
        <UploadDocumentModal
          caseId={t.case_id}
          surveyTaskId={t.id}
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            setUploadOpen(false);
            surveyDocs.reload();
          }}
        />
      )}

      {discrepancyOpen && (
        <DiscrepancyModal
          surveyTaskId={t.id}
          caseNumber={t.case_number}
          suggestedType={discrepancyOpen}
          onClose={() => setDiscrepancyOpen(null)}
          onDone={() => setDiscrepancyOpen(null)}
        />
      )}

      <StepUpConfirmModal
        open={stepupOpen}
        onClose={() => setStepupOpen(false)}
        onVerified={onVerifiedSubmit}
      />
    </>
  );
}

function StepLand({ t, parcel }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Land details</h2>
      </div>
      <div className="facts">
        <div>
          <p className="fact__label">CASE</p>
          <p className="fact__value">{t.case_number}</p>
        </div>
        <div>
          <p className="fact__label">PROJECT</p>
          <p className="fact__value">{t.project_name}</p>
        </div>
        <div>
          <p className="fact__label">VILLAGE</p>
          <p className="fact__value">{t.village_name}</p>
        </div>
        <div>
          <p className="fact__label">SURVEY NO.</p>
          <p className="fact__value">{t.parcel_survey_number || '—'}</p>
        </div>
        {parcel.loading && <Loading inline rows={1} />}
        {parcel.data && (
          <>
            <div>
              <p className="fact__label">ULPIN</p>
              <p className="fact__value">{parcel.data.ulpin || '—'}</p>
            </div>
            <div>
              <p className="fact__label">RECORDED AREA</p>
              <p className="fact__value">{fmt.hectaresPlain(parcel.data.area_ha)} ha</p>
            </div>
            <div>
              <p className="fact__label">RECORDED OWNER</p>
              <p className="fact__value">{parcel.data.owner_name}</p>
            </div>
          </>
        )}
        {!t.parcel_id && (
          <div style={{ gridColumn: '1 / -1' }}>
            <p className="fact__value" style={{ color: 'var(--text-faint)' }}>
              No specific parcel linked to this task — record what you observe below and record a
              parcel from the case page when back at a desk, if one is confirmed.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function StepPerson({
  parcel,
  showOnSitePersonFields,
  setShowOnSitePersonFields,
  onSitePersonName,
  setOnSitePersonName,
  onSitePersonRelation,
  setOnSitePersonRelation,
  personVerified,
  setPersonVerified,
  personVerificationNote,
  setPersonVerificationNote,
}) {
  const ownerName = parcel.data ? parcel.data.owner_name : null;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Person</h2>
      </div>

      {ownerName ? (
        <div className="person-card">
          <p className="person-card__name">{ownerName}</p>
          <p className="person-card__meta">Recorded owner on file for this parcel</p>
          <div className="person-card__actions">
            <Button
              variant={personVerified && !showOnSitePersonFields ? 'primary' : 'secondary'}
              className="wizard-btn"
              onClick={() => {
                setPersonVerified(true);
                setShowOnSitePersonFields(false);
              }}
            >
              Confirm — present on site
            </Button>
            <Button
              variant={showOnSitePersonFields ? 'primary' : 'quiet'}
              className="wizard-btn"
              onClick={() => {
                setShowOnSitePersonFields(true);
                setPersonVerified(false);
              }}
            >
              Different person on site
            </Button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          No recorded owner on file for this parcel. Record who you spoke to below.
        </p>
      )}

      {(showOnSitePersonFields || !ownerName) && (
        <div style={{ display: 'grid', gap: 'var(--s4)', marginTop: 'var(--s4)' }}>
          <Input
            label="Name"
            value={onSitePersonName}
            onChange={(event) => setOnSitePersonName(event.target.value)}
            placeholder="Full name"
          />
          <Input
            label="Relation to the land"
            value={onSitePersonRelation}
            onChange={(event) => setOnSitePersonRelation(event.target.value)}
            placeholder="Tenant, family member, caretaker…"
          />
        </div>
      )}

      <Textarea
        label="Remarks"
        value={personVerificationNote}
        onChange={(event) => setPersonVerificationNote(event.target.value)}
        maxLength={4000}
        placeholder="Anything else worth recording about who was present."
        hint="Optional."
      />
    </section>
  );
}

function StepLocation({ t, location, demoFix, onUseLocation, onUseDemoLocation }) {
  const fix = location.fix || demoFix;
  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Location</h2>
      </div>
      <div
        className={`fix${fix && !location.tooLoose ? ' is-good' : ''}${location.tooLoose ? ' is-bad' : ''}`}
      >
        <p className="fix__head">
          <Crosshair size={15} strokeWidth={1.75} aria-hidden="true" />
          Position from this device
        </p>
        {location.error && <p className="fix__note is-error">{location.error}</p>}
        {fix && (
          <p className="fix__coords">
            {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}
            {fix.isDemo ? ' — DEMO LOCATION' : ` — accurate to about ${Math.round(fix.accuracy)} m`}
          </p>
        )}
        {!fix && t.has_location && !location.error && (
          <p className="fix__note">Already recorded earlier in this survey.</p>
        )}
        <span style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <Button variant="secondary" className="wizard-btn" onClick={onUseLocation} disabled={location.locating}>
            {location.locating ? 'Getting a fix…' : 'Capture current location'}
          </Button>
          {(location.error || !location.supported) && (
            <Button variant="quiet" className="wizard-btn" onClick={onUseDemoLocation}>
              Use demo location
            </Button>
          )}
        </span>
      </div>
    </section>
  );
}

function StepMeasurement({
  t, areaInput, setAreaInput, recordedAreaHa, areaDiff, areaDiffPct, showAreaDiscrepancyPrompt,
  onFlagDiscrepancy, corner, corners, onAddCorner, onClearCorners,
}) {
  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Measurement</h2>
        </div>
        {recordedAreaHa != null && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 'var(--s3)' }}>
            Recorded area: <strong>{fmt.hectaresPlain(recordedAreaHa)} ha</strong>
          </p>
        )}
        <Input
          label="Measured area (hectares)"
          type="number"
          step="0.0001"
          min="0"
          inputMode="decimal"
          value={areaInput}
          onChange={(event) => setAreaInput(event.target.value)}
        />
        {areaDiff != null && (
          <p style={{ fontSize: 12.5, marginTop: 'var(--s2)', color: showAreaDiscrepancyPrompt ? 'var(--danger)' : 'var(--text-muted)' }}>
            Difference: {areaDiff >= 0 ? '+' : ''}{fmt.hectaresPlain(areaDiff)} ha
            {areaDiffPct != null ? ` (${(areaDiffPct * 100).toFixed(1)}%)` : ''}
          </p>
        )}
        {showAreaDiscrepancyPrompt && (
          <div className="wizard-offline" style={{ marginTop: 'var(--s3)' }}>
            <span>Area discrepancy detected — this differs from the record by more than 5%.</span>
            <Button variant="quiet" className="wizard-btn" onClick={onFlagDiscrepancy}>
              Flag for review
            </Button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Boundary</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t.boundary_point_count >= MIN_BOUNDARY_CORNERS
              ? `${t.boundary_point_count} corners on file`
              : 'Not walked yet'}
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 'var(--s3)' }}>
          Walk the parcel and tap "Add corner" at each corner, in order. At least {MIN_BOUNDARY_CORNERS}{' '}
          are needed before it can be saved as a boundary.
        </p>
        {corner.error && <p className="fix__note is-error">{corner.error}</p>}
        {corners.length > 0 && (
          <ol className="survey-corners">
            {corners.map((point, index) => (
              <li key={index}>
                Corner {index + 1}: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
              </li>
            ))}
          </ol>
        )}
        <span style={{ display: 'flex', gap: 'var(--s3)' }}>
          <Button variant="secondary" className="wizard-btn" onClick={onAddCorner} disabled={corner.locating}>
            {corner.locating ? 'Getting a fix…' : 'Add corner'}
          </Button>
          {corners.length > 0 && (
            <Button variant="quiet" className="wizard-btn" onClick={onClearCorners}>
              Clear
            </Button>
          )}
        </span>
      </section>
    </>
  );
}

function StepEvidence({
  t, uploadPhoto, photoCategory, setPhotoCategory, fileInputRef, onPickPhotos, onDeletePhoto,
  surveyDocs, onUpload,
}) {
  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Photos</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.photos.length}</span>
        </div>
        {uploadPhoto.error && <ErrorState error={uploadPhoto.error} title="Photo could not be uploaded" />}

        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 'var(--s2)' }}>
          Category for the next photo(s) taken
        </p>
        <div className="tag-picker" style={{ marginBottom: 'var(--s4)' }}>
          {PHOTO_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`tag-picker__tag${photoCategory === c ? ' is-selected' : ''}`}
              onClick={() => setPhotoCategory(c)}
            >
              {surveyPhotoCategoryLabel(c)}
            </button>
          ))}
        </div>

        {t.photos.length > 0 && (
          <div className="survey-photos">
            {t.photos.map((photo) => (
              <PhotoThumbnail key={photo.id} taskId={t.id} photo={photo} onRemove={() => onDeletePhoto(photo.id)} />
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          style={{ display: 'none' }}
          onChange={onPickPhotos}
        />
        <Button
          variant="secondary"
          className="wizard-btn"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={uploadPhoto.pending}
        >
          {uploadPhoto.pending ? 'Uploading…' : 'Take photo'}
        </Button>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Documents</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{surveyDocs.data ? surveyDocs.data.total : ''}</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 'var(--s3)' }}>
          A survey report, field note, sketch, or measurement evidence for this specific
          fieldwork — the case's formal document list is separate.
        </p>
        {surveyDocs.data && surveyDocs.data.items.length > 0 && (
          <ul className="doc-history" style={{ marginBottom: 'var(--s3)' }}>
            {surveyDocs.data.items.map((doc) => (
              <li key={doc.id}>
                <span className="doc-history__body">
                  {doc.filename}
                  <br />
                  <span className="doc-history__meta">{fmt.date(doc.uploaded_on)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" className="wizard-btn" onClick={onUpload}>
          Upload document
        </Button>
      </section>
    </>
  );
}

function StepObservations({
  landUse, setLandUse, boundaryCondition, setBoundaryCondition, physicalFeatures, onToggleFeature,
  remarksInput, setRemarksInput, checklist, boundaryDiscrepancyFlag, onToggleBoundaryDiscrepancy,
  onFlagDiscrepancy,
}) {
  const groups = [...new Set(checklist.map((c) => c.group))];
  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Field observations</h2>
        </div>
        <Select
          label="Land use"
          value={landUse}
          placeholder="Select what the land is being used for"
          options={LAND_USES.map((v) => ({ value: v, label: landUseTypeLabel(v) }))}
          onChange={(event) => setLandUse(event.target.value)}
        />
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '0 0 var(--s2)' }}>Physical features</p>
        <div className="tag-picker" style={{ marginBottom: 'var(--s4)' }}>
          {PHYSICAL_FEATURES.map((f) => (
            <button
              key={f}
              type="button"
              className={`tag-picker__tag${physicalFeatures.includes(f) ? ' is-selected' : ''}`}
              onClick={() => onToggleFeature(f)}
            >
              {physicalFeatureLabel(f)}
            </button>
          ))}
        </div>
        <Select
          label="Boundary condition"
          value={boundaryCondition}
          placeholder="How clearly could the boundary be established?"
          options={BOUNDARY_CONDITIONS.map((v) => ({ value: v, label: boundaryConditionLabel(v) }))}
          onChange={(event) => setBoundaryCondition(event.target.value)}
        />
        <Textarea
          label="Officer observations"
          value={remarksInput}
          maxLength={4000}
          rows={4}
          placeholder="Access, condition, anything the reviewer should know."
          onChange={(event) => setRemarksInput(event.target.value)}
        />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Checklist</h2>
        </div>
        <div className="checklist">
          {groups.map((group) => (
            <div className="checklist__group" key={group}>
              <p className="checklist__group-title">{group}</p>
              {checklist
                .filter((item) => item.group === group)
                .map((item) =>
                  item.manual ? (
                    <button
                      key={item.key}
                      type="button"
                      className={`checklist__item checklist__item--manual${item.done ? ' is-done' : ''}`}
                      onClick={() => {
                        onToggleBoundaryDiscrepancy();
                        if (!boundaryDiscrepancyFlag) onFlagDiscrepancy();
                      }}
                    >
                      <span className="checklist__mark">{item.done ? '✓' : ''}</span>
                      <span className="checklist__label">{item.label}</span>
                    </button>
                  ) : (
                    <div key={item.key} className={`checklist__item${item.done ? ' is-done' : ''}`}>
                      <span className="checklist__mark">{item.done ? '✓' : ''}</span>
                      <span className="checklist__label">{item.label}</span>
                    </div>
                  ),
                )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function StepReview({
  t, parcel, areaInput, landUse, boundaryCondition, physicalFeatures, remarksInput,
  onSitePersonName, onSitePersonRelation, personVerified, checklist, hasLocation,
}) {
  const doneCount = checklist.filter((c) => c.done).length;
  const rows = [
    ['Case', t.case_number],
    ['Survey no.', t.parcel_survey_number || '—'],
    ['ULPIN', (parcel.data && parcel.data.ulpin) || '—'],
    ['Village', t.village_name],
    [
      'Person',
      personVerified
        ? `${(parcel.data && parcel.data.owner_name) || 'Recorded owner'} — confirmed on site`
        : onSitePersonName
          ? `${onSitePersonName}${onSitePersonRelation ? ` (${onSitePersonRelation})` : ''}`
          : '—',
    ],
    ['Location', hasLocation ? 'Captured' : 'Not captured'],
    ['Measured area', areaInput ? `${areaInput} ha` : (t.measured_area_ha != null ? `${t.measured_area_ha} ha` : '—')],
    ['Boundary', t.boundary_point_count >= MIN_BOUNDARY_CORNERS ? `${t.boundary_point_count} corners` : 'Not walked'],
    ['Land use', landUse ? landUseTypeLabel(landUse) : '—'],
    ['Boundary condition', boundaryCondition ? boundaryConditionLabel(boundaryCondition) : '—'],
    ['Features', physicalFeatures.length ? physicalFeatures.map(physicalFeatureLabel).join(', ') : '—'],
    ['Photos', String(t.photos.length)],
    ['Observations', remarksInput || '—'],
    ['Checklist', `${doneCount} of ${checklist.length} complete`],
  ];

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Review</h2>
      </div>
      <div className="review-list">
        {rows.map(([label, value]) => (
          <div className="review-row" key={label}>
            <span className="review-row__label">{label}</span>
            <span className="review-row__value">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhotoThumbnail({ taskId, photo, onRemove }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    (async () => {
      try {
        const res = await api.raw(`/survey-tasks/${taskId}/photos/${photo.id}`);
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        /* thumbnail just stays blank */
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, photo.id]);

  return (
    <div className="survey-photo">
      {src ? <img src={src} alt={photo.caption || 'Survey photo'} /> : <div className="survey-photo__placeholder" />}
      {photo.category && <span className="survey-photo__caption">{surveyPhotoCategoryLabel(photo.category)}</span>}
      {onRemove && (
        <button type="button" className="survey-photo__remove" onClick={onRemove} aria-label="Remove photo">
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
