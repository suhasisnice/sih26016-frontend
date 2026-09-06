/* Display text and status colour for the API's enum values.

   /meta/enums publishes the values but no labels, and something has to turn
   `rehabilitation_resettlement` into "Rehabilitation & Resettlement". That
   mapping lives here rather than in components, so rule 2 still holds: a
   component never types an enum string, it asks for the label of a value it
   received from the API.

   Every lookup falls back to a humanised form of the raw value, so a new
   enum value added by the backend renders as readable text rather than
   blank — visibly imperfect, never broken. */

function humanise(value) {
  if (!value) return '—';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

const STAGE = {
  preliminary_notification: 'Preliminary Notification',
  social_impact_assessment: 'Social Impact Assessment',
  land_verification: 'Land Verification',
  objection_period: 'Objection Period',
  declaration: 'Declaration',
  award: 'Award',
  rehabilitation_resettlement: 'Rehabilitation & Resettlement',
  possession: 'Possession',
  monitoring: 'Monitoring',
};

/* The section of the Act each stage comes from. This is the kind of detail
   that makes the product unmistakably this product — CLAUDE.md 4.4 — and it
   is shown on the timeline, not decorated onto every list. */
const STAGE_SECTION = {
  preliminary_notification: 'Section 11',
  social_impact_assessment: 'Sections 4–9',
  land_verification: 'Section 12',
  objection_period: 'Section 15',
  declaration: 'Section 19',
  award: 'Sections 23–30',
  rehabilitation_resettlement: 'Second Schedule',
  possession: 'Section 38',
  monitoring: 'Section 48',
};

const CASE_STATUS = {
  active: 'Active',
  stalled: 'Stalled',
  closed: 'Closed',
};

const PARCEL_STATUS = {
  notified: 'Notified',
  under_acquisition: 'Under acquisition',
  acquired: 'Acquired',
  possession_taken: 'Possession taken',
};

const COMPENSATION_STATUS = {
  pending: 'Pending',
  assessed: 'Assessed',
  awarded: 'Awarded',
  paid: 'Paid',
  disputed: 'Disputed',
};

const RNR_STATUS = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  disputed: 'Disputed',
};

const OBJECTION_STATUS = {
  filed: 'Filed',
  under_review: 'Under review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const DOCUMENT_VERIFICATION_STATUS = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
  correction_requested: 'Correction requested',
};

const BENEFIT_CATEGORY = {
  housing: 'Housing',
  land: 'Land',
  employment: 'Employment',
  annuity: 'Annuity',
  other: 'Other',
};

const BENEFIT_DELIVERY_STATUS = {
  pending: 'Pending',
  approved: 'Approved',
  in_process: 'In process',
  delivered: 'Delivered',
  failed: 'Failed',
  review_required: 'Needs review',
};

/* Where a record's data actually came from. `official` is reserved for
   data traceable to a cited government dataset — nothing in this prototype
   sets it, because none exists here to cite. See DataSource in the
   backend's app.core.enums for the full policy. */
const DATA_SOURCE = {
  official: 'Official data',
  public_reference: 'Public reference',
  synthetic: 'Synthetic prototype data',
};

const PROVENANCE_STATUS = {
  verified: 'Verified',
  unverified: 'Unverified',
  synthetic: 'Synthetic',
};

const SEVERITY = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const ROLE = {
  landowner: 'Landowner',
  field_officer: 'Field Officer',
  slao: 'Special Land Acquisition Officer',
  rnr_officer: 'Rehabilitation & Resettlement Officer',
  district_officer: 'District Collector',
  requiring_body: 'Requiring Body',
  state_officer: 'State Land Acquisition Cell',
  ministry_officer: 'Central Ministry',
  admin: 'State Administrator',
};

/* Where a proposal sits in the approval chain. `returned` is deliberately
   worded as an instruction rather than a verdict — it is the commonest real
   outcome and means "fix this and resend", not "no". */
const PROPOSAL_STATUS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_scrutiny: 'Under scrutiny',
  returned: 'Returned for revision',
  approved: 'Sanctioned',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/* The published instruments under the Act. Named as an officer would name
   them, with the section carried separately in PROPOSAL/NOTICE_SECTION. */
const NOTICE_TYPE = {
  preliminary_notification: 'Preliminary notification',
  declaration: 'Declaration',
  award: 'Award',
  possession_notice: 'Possession notice',
};

const NOTICE_SECTION = {
  preliminary_notification: 'Section 11',
  declaration: 'Section 19',
  award: 'Section 23',
  possession_notice: 'Section 38',
};

const TIMELINE_STATUS = {
  on_time: 'On time',
  at_risk: 'Due soon',
  breached: 'Overdue',
};

/* Bands rather than a raw score. A 0.61 invites false precision from a model
   built on a few hundred transitions; "Elevated" does not. */
const RISK_BAND = {
  low: 'Low',
  moderate: 'Moderate',
  elevated: 'Elevated',
  severe: 'Severe',
};

const DOC_TYPE = {
  notification_copy: 'Notification copy',
  gazette_publication: 'Gazette publication',
  sia_report: 'Social impact assessment report',
  public_hearing_minutes: 'Public hearing minutes',
  land_record: 'Land record',
  survey_map: 'Survey map',
  ownership_proof: 'Ownership proof',
  objection_form: 'Objection form',
  hearing_notice: 'Hearing notice',
  declaration_copy: 'Declaration copy',
  award_copy: 'Award copy',
  compensation_assessment: 'Compensation assessment',
  rnr_entitlement_list: 'R&R entitlement list',
  rnr_scheme_document: 'R&R scheme document',
  possession_certificate: 'Possession certificate',
  monitoring_report: 'Monitoring report',
};

/* The alert rules the AI layer runs. Keyed by the `rule` string on an alert. */
const RULE = {
  case_stalled: 'Case stalled',
  document_missing: 'Documents missing',
  objection_unanswered: 'Objection unanswered',
  award_unpaid: 'Award unpaid',
  possession_before_rnr: 'Possession before R&R',
  timeline_breach: 'Stage deadline passed',
  fund_deposit_missing: 'Fund deposit missing',
  unused_land: 'Unused land past five years',
};

const lookup = (table) => (value) => table[value] || humanise(value);

export const stageLabel = lookup(STAGE);
export const stageSection = (value) => STAGE_SECTION[value] || null;
export const caseStatusLabel = lookup(CASE_STATUS);
export const parcelStatusLabel = lookup(PARCEL_STATUS);
export const compensationStatusLabel = lookup(COMPENSATION_STATUS);
export const rnrStatusLabel = lookup(RNR_STATUS);
export const objectionStatusLabel = lookup(OBJECTION_STATUS);
export const documentVerificationStatusLabel = lookup(DOCUMENT_VERIFICATION_STATUS);
export const benefitCategoryLabel = lookup(BENEFIT_CATEGORY);
export const benefitDeliveryStatusLabel = lookup(BENEFIT_DELIVERY_STATUS);
export const dataSourceLabel = lookup(DATA_SOURCE);
export const provenanceStatusLabel = lookup(PROVENANCE_STATUS);
export const severityLabel = lookup(SEVERITY);
export const roleLabel = lookup(ROLE);
export const docTypeLabel = lookup(DOC_TYPE);
export const ruleLabel = lookup(RULE);
export const proposalStatusLabel = lookup(PROPOSAL_STATUS);
export const noticeTypeLabel = lookup(NOTICE_TYPE);
export const noticeSection = (value) => NOTICE_SECTION[value] || null;
export const timelineStatusLabel = lookup(TIMELINE_STATUS);
export const riskBandLabel = lookup(RISK_BAND);

/* Which status colour a value carries. `--brand` is never returned: the mauve
   means "navigation or a thing you can click", never a state. CLAUDE.md 3.3. */
const TONE = {
  // case status
  active: 'info',
  stalled: 'danger',
  closed: 'idle',
  // parcel status
  notified: 'idle',
  under_acquisition: 'warn',
  acquired: 'ok',
  possession_taken: 'ok',
  // compensation
  pending: 'idle',
  assessed: 'info',
  awarded: 'warn',
  paid: 'ok',
  disputed: 'danger',
  // rnr
  in_progress: 'warn',
  completed: 'ok',
  // objection
  filed: 'warn',
  under_review: 'info',
  resolved: 'ok',
  rejected: 'danger',
  // severity
  low: 'idle',
  medium: 'info',
  high: 'warn',
  critical: 'danger',
  // proposal status. `returned` is warn, not danger: it is a correctable
  // defect and the commonest outcome, while `rejected` is a refusal.
  draft: 'idle',
  submitted: 'info',
  under_scrutiny: 'info',
  returned: 'warn',
  approved: 'ok',
  withdrawn: 'idle',
  // timeline. `at_risk` shares the warn tone with everything else that has
  // not gone wrong YET, which is the distinction the colour is carrying.
  on_time: 'ok',
  at_risk: 'warn',
  breached: 'danger',
  // predicted risk
  moderate: 'info',
  elevated: 'warn',
  severe: 'danger',
  // document verification. pending and rejected are shared with
  // compensation/objection above and already correct for this too.
  verified: 'ok',
  correction_requested: 'warn',
  // benefit delivery. `approved` is shared with proposal status above.
  in_process: 'warn',
  delivered: 'ok',
  failed: 'danger',
  review_required: 'danger',
  // data provenance. `official` is unused today (nothing in this prototype
  // has a cited source) but supported for when one exists. `unverified` is
  // shared with nothing above — it means "a real fact, not formally
  // checked", which is neither good nor bad, just informational.
  official: 'ok',
  public_reference: 'info',
  unverified: 'info',
};

export function tone(value) {
  return TONE[value] || 'idle';
}
