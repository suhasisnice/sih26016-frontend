import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileEdit } from 'lucide-react';
import * as objectionsApi from '../api/objections';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import * as fmt from '../lib/format';
import { objectionStatusLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import RespondObjectionModal from '../components/case/RespondObjectionModal';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
// .trail* is Proposals' review-trail pattern, reused here rather than
// duplicated — same precedent as Objections.jsx importing caselist.css for
// .filters.
import '../pages/proposals.css';
import './objections.css';

/* Built to the Figma "Objection Detail" frame — the stepper and activity
   list, adapted to what an objection actually records.

   The frame shows three named steps (Submitted / Assigned / Under review)
   and a four-entry activity log with a named reviewer, an assignment event
   and a document upload. Objection only ever stores three real facts:
   filed_on, an optional response, and responded_on — there is no assignee,
   no per-step timestamp, no document trail. Rather than invent the missing
   two-thirds of that log, the stepper here has three nodes keyed off the
   real status enum (filed / under_review / resolved-or-rejected) and the
   activity list has exactly as many entries as there are real events: one
   if still open, two once answered. */

export default function ObjectionDetail() {
  const { objectionId } = useParams();
  const { user } = useAuth();
  const [responding, setResponding] = useState(false);

  const objection = useApi((opts) => objectionsApi.get(objectionId, opts), [objectionId]);
  const o = objection.data;

  if (objection.loading) return <Loading label="Loading the objection" rows={6} />;
  if (objection.error) return <ErrorState error={objection.error} onRetry={objection.reload} />;
  if (!o) return null;

  const isTerminal = o.status === 'resolved' || o.status === 'rejected';

  /* Not index math against a single "current step" — an officer may resolve
     or reject straight from "filed" without ever setting under_review, and
     nothing records whether a since-decided objection passed through it.
     Claiming that step is "done" whenever the outcome is terminal would
     assert a transition the data cannot back up, so it only ever shows as
     done, current or upcoming from what is actually true of `o.status`. */
  const steps = [
    { key: 'filed', label: 'Filed', date: o.filed_on, state: 'done' },
    {
      key: 'under_review',
      label: 'Under review',
      date: null,
      state: o.status === 'under_review' ? 'current' : 'upcoming',
    },
    {
      key: 'terminal',
      label: isTerminal ? objectionStatusLabel(o.status) : 'Outcome',
      date: isTerminal ? o.responded_on : null,
      state: isTerminal ? 'done' : 'upcoming',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={['Objection management', o.case_number]}
        title="Objection detail"
        subtitle="View the objection, its grounds, and where it stands in the response window."
        actions={
          can.respondToObjection(user) &&
          !o.response && (
            <Button variant="primary" onClick={() => setResponding(true)}>
              Update status
            </Button>
          )
        }
      />

      <dl className="objection-facts">
        <div>
          <dt>Objection ID</dt>
          <dd>OBJ-{String(o.id).padStart(4, '0')}</dd>
        </div>
        <div>
          <dt>Related case</dt>
          <dd>
            <Link to={`/cases/${o.case_id}`}>{o.case_number}</Link>
          </dd>
        </div>
        <div>
          <dt>Filed by</dt>
          <dd>{o.person_name}</dd>
        </div>
        <div>
          <dt>Filed on</dt>
          <dd>{fmt.date(o.filed_on)}</dd>
        </div>
      </dl>

      <div className="objection-summary">
        <p className="objection-summary__label">Grounds</p>
        <p>{o.grounds}</p>
      </div>

      <div className="stepper" role="list" aria-label="Objection progress">
        {steps.map((step, index) => (
          <div key={step.key} className={`stepper__node is-${step.state}`} role="listitem">
            <span className="stepper__marker" aria-hidden="true">
              {step.state === 'done' ? <CheckCircle2 size={16} strokeWidth={2} /> : index + 1}
            </span>
            <span className="stepper__label">{step.label}</span>
            {step.date && <span className="stepper__date">{fmt.date(step.date)}</span>}
            {index < steps.length - 1 && <span className="stepper__connector" aria-hidden="true" />}
          </div>
        ))}
      </div>

      <h2 className="objection-section">Activity</h2>
      <ol className="trail">
        <li className={`trail__item${!o.response ? ' is-current' : ''}`}>
          <div className="trail__head">
            <StatusBadge kind="objection" value="filed" />
            <span className="trail__actor">Filed by {o.person_name}</span>
            <span className="trail__date">{fmt.date(o.filed_on)}</span>
          </div>
          <p className="trail__note">{o.grounds}</p>
        </li>
        {o.response && (
          <li className="trail__item is-current">
            <div className="trail__head">
              <StatusBadge kind="objection" value={o.status} />
              <span className="trail__actor">Response recorded</span>
              <span className="trail__date">{fmt.date(o.responded_on)}</span>
            </div>
            <p className="trail__note">{o.response}</p>
          </li>
        )}
        {!o.response && (
          <li className="trail__item objection-trail__waiting">
            <div className="trail__head">
              <FileEdit size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="trail__actor">Awaiting a response within the statutory window</span>
            </div>
          </li>
        )}
      </ol>

      {responding && (
        <RespondObjectionModal
          objection={o}
          onClose={() => setResponding(false)}
          onDone={() => {
            setResponding(false);
            objection.reload();
          }}
        />
      )}
    </>
  );
}
