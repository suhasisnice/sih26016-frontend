import {
  benefitDeliveryStatusLabel,
  caseStatusLabel,
  compensationStatusLabel,
  documentVerificationStatusLabel,
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
   table to read, `tone()` in lib/labels picks the colour from the value
   itself, so a new status added to any enum gets a badge for free. */
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
};

export default function StatusBadge({ kind, value, title }) {
  const label = (LABEL_BY_KIND[kind] || ((v) => v))(value);
  return (
    <span className={`badge badge--${tone(value)}`} title={title || undefined}>
      <span className="badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
