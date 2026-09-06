/* What each role may do, mirroring the backend's route guards.

   This decides whether a button is rendered. It is NOT the security boundary
   — the backend enforces every one of these with require_role, and a hidden
   button is a courtesy, not a control. The two lists are kept deliberately
   identical so a role never sees an action that will 403 the moment they use
   it, which in a demo looks worse than not offering it at all. */

const ADMIN = 'admin';
const DISTRICT_OFFICER = 'district_officer';
const SLAO = 'slao';
const FIELD_OFFICER = 'field_officer';
const RNR_OFFICER = 'rnr_officer';
const LANDOWNER = 'landowner';
const REQUIRING_BODY = 'requiring_body';
const STATE_OFFICER = 'state_officer';
const MINISTRY_OFFICER = 'ministry_officer';

/* District-and-below staff. A state officer and a ministry officer are NOT
   here: they read across districts and do not operate a case, which is
   exactly the distinction the backend's scope_cases_to_user draws. */
const OFFICERS = [ADMIN, DISTRICT_OFFICER, SLAO, FIELD_OFFICER, RNR_OFFICER];

/* Everyone who works a caseload or oversees one, and so gets the dashboard,
   the map and the reports. Mirrors the union of the backend's district-,
   state- and national-read scopes. */
const SUPERVISORY = [...OFFICERS, STATE_OFFICER, MINISTRY_OFFICER];

/* Mirrors cases.CASE_WRITERS */
const CASE_WRITERS = [ADMIN, DISTRICT_OFFICER, SLAO];
/* Mirrors persons.COMPENSATION_WRITERS */
const COMPENSATION_WRITERS = [ADMIN, DISTRICT_OFFICER, SLAO];
/* Mirrors persons.RNR_WRITERS — an SLAO is deliberately absent */
const RNR_WRITERS = [ADMIN, DISTRICT_OFFICER, RNR_OFFICER];
/* Mirrors persons.PERSON_WRITERS */
const PERSON_WRITERS = [ADMIN, DISTRICT_OFFICER, SLAO, FIELD_OFFICER];
/* Mirrors documents.DOCUMENT_UPLOADERS and cases.CASE_AUDIT_READERS */
const DOCUMENT_UPLOADERS = OFFICERS;
/* Mirrors documents.DOCUMENT_VERIFIERS — reviewing is narrower than
   filing: whoever can move a case's stage is who verifies its documents. */
const DOCUMENT_VERIFIERS = CASE_WRITERS;
const AUDIT_READERS = OFFICERS;
/* Mirrors objections.OBJECTION_RESPONDERS */
const OBJECTION_RESPONDERS = [ADMIN, DISTRICT_OFFICER, SLAO];
/* Mirrors parcels.PARCEL_WRITERS — the field officer is the point of it */
const PARCEL_WRITERS = [ADMIN, DISTRICT_OFFICER, SLAO, FIELD_OFFICER];
/* Mirrors notices.NOTICE_ISSUERS — narrower than the general case writers,
   because publishing a statutory instrument is not a field action */
const NOTICE_ISSUERS = [ADMIN, DISTRICT_OFFICER, SLAO];
/* Mirrors survey.SURVEY_PERFORMERS — who can be assigned to, and work, a
   field survey task. */
const SURVEY_PERFORMERS = [ADMIN, FIELD_OFFICER];
/* Mirrors survey.SURVEY_ASSIGNERS, which is also survey.SURVEY_REVIEWERS on
   the backend — whoever can hand a survey to a named field officer is also
   who decides whether it came back right. */
const SURVEY_ASSIGNERS = [ADMIN, DISTRICT_OFFICER, SLAO];
/* Mirrors proposals.PROPOSAL_AUTHORS */
const PROPOSAL_AUTHORS = [REQUIRING_BODY, ADMIN];
/* Anyone with a place in the approval chain, plus the district office that
   sees proposals routed to it. Mirrors dependencies.scope_proposals_to_user
   returning something other than "nothing". */
const PROPOSAL_VIEWERS = [
  REQUIRING_BODY,
  STATE_OFFICER,
  MINISTRY_OFFICER,
  DISTRICT_OFFICER,
  SLAO,
  FIELD_OFFICER,
  RNR_OFFICER,
  ADMIN,
];
/* Mirrors the role lists on exports.py. A landowner is absent from both. */
const REPORT_READERS = [
  ADMIN,
  DISTRICT_OFFICER,
  SLAO,
  RNR_OFFICER,
  STATE_OFFICER,
  MINISTRY_OFFICER,
];

const has = (list) => (user) => Boolean(user) && list.includes(user.role);

export const can = {
  createCase: has(CASE_WRITERS),
  editCase: has(CASE_WRITERS),
  advanceStage: has(CASE_WRITERS),
  editCompensation: has(COMPENSATION_WRITERS),
  editRnr: has(RNR_WRITERS),
  /* Mirrors persons.RNR_WRITERS too — the itemised benefits underneath an
     R&R record are written by whoever writes the record itself. */
  manageRnrBenefits: has(RNR_WRITERS),
  addPerson: has(PERSON_WRITERS),
  uploadDocument: has(DOCUMENT_UPLOADERS),
  verifyDocument: has(DOCUMENT_VERIFIERS),
  readAudit: has(AUDIT_READERS),
  respondToObjection: has(OBJECTION_RESPONDERS),
  runRules: has([ADMIN]),
  createParcel: has(PARCEL_WRITERS),
  editParcel: has(PARCEL_WRITERS),
  issueNotice: has(NOTICE_ISSUERS),
  performSurvey: has(SURVEY_PERFORMERS),
  assignSurvey: has(SURVEY_ASSIGNERS),
  reviewSurvey: has(SURVEY_ASSIGNERS),
  createProposal: has(PROPOSAL_AUTHORS),
  editProposal: has(PROPOSAL_AUTHORS),
  viewProposals: has(PROPOSAL_VIEWERS),
  scrutiniseProposal: has([STATE_OFFICER, DISTRICT_OFFICER, ADMIN]),
  sanctionProposal: has([MINISTRY_OFFICER, ADMIN]),
  viewReports: has(REPORT_READERS),
  exportCompensation: has([ADMIN, DISTRICT_OFFICER, SLAO, STATE_OFFICER, MINISTRY_OFFICER]),
  viewDashboard: has(SUPERVISORY),
  /* A landowner files an objection about their own case; officers record one
     on a person's behalf. Both hit the same route. */
  fileObjection: (user) => Boolean(user),
};

export const isOfficer = has(OFFICERS);
export const isLandowner = has([LANDOWNER]);
export const isRequiringBody = has([REQUIRING_BODY]);
/* Reads across districts and does not operate a case. Used to decide whether
   to offer a state or national scope selector at all. */
export const isOversight = has([STATE_OFFICER, MINISTRY_OFFICER]);

export const ROLES = {
  ADMIN,
  DISTRICT_OFFICER,
  SLAO,
  FIELD_OFFICER,
  RNR_OFFICER,
  LANDOWNER,
  REQUIRING_BODY,
  STATE_OFFICER,
  MINISTRY_OFFICER,
};

export { OFFICERS, SUPERVISORY, PROPOSAL_AUTHORS, PROPOSAL_VIEWERS, REPORT_READERS };
