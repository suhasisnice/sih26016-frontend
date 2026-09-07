import {
  benefitDeliveryStatusLabel,
  caseStatusLabel,
  compensationStatusLabel,
  documentVerificationStatusLabel,
  noticeTypeLabel,
  objectionStatusLabel,
  parcelStatusLabel,
  proposalStatusLabel,
  riskBandLabel,
  rnrStatusLabel,
  severityLabel,
  stageLabel,
  surveyTaskStatusLabel,
  timelineStatusLabel,
  tone,
} from '../../lib/labels';

/* A tinted pill, colour and word together — never colour alone, since some
   judges will be colour blind and some rooms have terrible projectors.
   CLAUDE.md 3.3.

   One component reused for every enum on screen: `kind` picks which label
   table to read, and `tone()` in lib/labels picks the colour from the value
   itself, so a new status added to any enum gets a badge for free. `kind` is
   passed to tone() as well, for the handful of values two enums share the
   spelling of but not the meaning — see TONE_BY_KIND there. */
const LABEL_BY_KIND = {
  stage: stageLabel,
  case: caseStatusLabel,
  severity: severityLabel,
  timeline: timelineStatusLabel,
  compensation: compensationStatusLabel,
  rnr: rnrStatusLabel,
  objection: objectionStatusLabel,
  parcel: parcelStatusLabel,
  proposal: proposalStatusLabel,
  risk: riskBandLabel,
  documentVerification: documentVerificationStatusLabel,
  benefitDelivery: benefitDeliveryStatusLabel,
  surveyTask: surveyTaskStatusLabel,
  /* Not a state — which instrument was published. It reads idle, like the
     stages do, because the public board is classifying rows rather than
     flagging anything as wrong. */
  noticeType: noticeTypeLabel,
};

export default function StatusBadge({ kind, value, title }) {
  const label = (LABEL_BY_KIND[kind] || ((v) => v))(value);
  return (
    <span className={`badge badge--${tone(value, kind)}`} title={title || undefined}>
      <span className="badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
