import { dataSourceLabel, tone } from '../../lib/labels';

/* Colour-dot-plus-word, same shape as StatusBadge — the honesty layer over
   every record a demo might be judged on. `provenance` is the ProvenanceOut
   object the backend nests into a case/parcel/project/person response
   (see app.schemas.provenance). Never colour alone: some judges will be
   colour blind, and "this is invented" is exactly the fact a badge with no
   word could be missed on. */
export default function ProvenanceBadge({ provenance }) {
  if (!provenance) return null;
  const title = provenance.source_name || undefined;
  return (
    <span className={`badge badge--${tone(provenance.data_source)}`} title={title}>
      <span className="badge__dot" aria-hidden="true" />
      {dataSourceLabel(provenance.data_source)}
    </span>
  );
}
