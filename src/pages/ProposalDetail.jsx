import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as proposalsApi from '../api/proposals';
import { useApi, useMutation } from '../hooks/useApi';
import * as fmt from '../lib/format';
import { proposalStatusLabel, roleLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import './proposals.css';

/* One proposal, and what this user may do with it.

   The action buttons are not decided here. The server sends
   `allowed_transitions` for the calling user with every detail response, and
   this screen renders exactly that list — so a button can never appear that
   the server will refuse, and a role holding nothing sees an explanation
   rather than a row of disabled controls. */

/* The verb each move is performed with, written from the acting officer's
   side of the desk. `approved` is "Sanction" because that is the word the
   file uses; nobody in a revenue office says they approved an acquisition. */
const ACTION = {
  submitted: { label: 'Submit for scrutiny', variant: 'primary' },
  under_scrutiny: { label: 'Take up for scrutiny', variant: 'primary' },
  returned: { label: 'Return for revision', variant: 'quiet', needsNote: true },
  approved: { label: 'Sanction', variant: 'primary', confirm: true },
  rejected: { label: 'Reject', variant: 'quiet', needsNote: true, confirm: true },
  withdrawn: { label: 'Withdraw', variant: 'quiet', needsNote: true },
};

export default function ProposalDetail() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const proposal = useApi((opts) => proposalsApi.get(proposalId, opts), [proposalId]);
  const move = useMutation((toStatus, text) => proposalsApi.transition(proposalId, toStatus, text));

  const p = proposal.data;

  async function apply(toStatus) {
    const action = ACTION[toStatus] || {};
    /* A return or a rejection with no reason is what makes an approval chain
       useless to the office receiving the file back. The server accepts an
       empty note; this screen does not. */
    if (action.needsNote && !note.trim()) {
      setNoteError('Say why — the requiring body sees this note and nothing else.');
      setConfirming(null);
      return;
    }
    setNoteError(null);
    try {
      const updated = await move.run(toStatus, note.trim() || null);
      setNote('');
      setConfirming(null);
      /* Sanction mints the case. Going straight to it is the point of the
         whole chain — leaving the reviewer on a spent proposal page after the
         one decision that creates something would be perverse. */
      if (updated.case_id) navigate(`/cases/${updated.case_id}`);
      else proposal.reload();
    } catch {
      setConfirming(null);
      /* useMutation holds the error; the routing panel renders it. */
    }
  }

  function onAction(toStatus) {
    if (ACTION[toStatus] && ACTION[toStatus].confirm) setConfirming(toStatus);
    else apply(toStatus);
  }

  if (proposal.loading) return <Loading label="Loading the proposal" rows={6} />;
  if (proposal.error) return <ErrorState error={proposal.error} onRetry={proposal.reload} />;
  if (!p) return null;

  const facts = [
    ['Requiring body', p.requiring_body],
    ['Village', p.village_name],
    ['District', p.district_name],
    ['State', p.state_name],
    ['Estimated area', fmt.hectares(p.estimated_area_ha)],
    ['Families affected', p.estimated_families === null ? '—' : fmt.count(p.estimated_families)],
    ['Estimated cost', fmt.rupees(p.estimated_cost)],
    ['Opened', fmt.date(p.created_at)],
    ['Submitted', fmt.date(p.submitted_on)],
    ['In this status', fmt.days(p.days_in_status)],
  ];

  return (
    <>
      <PageHeader
        back={{ to: '/proposals', label: 'All proposals' }}
        title={p.title}
        subtitle={`${p.proposal_number} · ${p.village_name}, ${p.district_name}`}
      />

      <div className="proposal">
        <div className="proposal__main">
          <p className="proposal__purpose">{p.purpose}</p>

          <dl className="proposal__facts">
            {facts.map(([term, value]) => (
              <div className="proposal__fact" key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="proposal__section">Review trail</h2>
          <ol className="trail">
            {p.reviews.map((review, index) => (
              <li
                key={review.id}
                className={`trail__item${index === p.reviews.length - 1 ? ' is-current' : ''}`}
              >
                <div className="trail__head">
                  <StatusBadge kind="proposal" value={review.to_status} />
                  <span className="trail__actor">
                    {review.actor_name || 'System'}
                    {review.actor_role ? ` · ${roleLabel(review.actor_role)}` : ''}
                  </span>
                  <span className="trail__date">{fmt.date(review.created_on)}</span>
                </div>
                {review.note && <p className="trail__note">{review.note}</p>}
              </li>
            ))}
          </ol>
        </div>

        <aside className="routing">
          <p className="routing__where">Currently with</p>
          <p className="routing__holder">{p.held_by}</p>
          <StatusBadge kind="proposal" value={p.status} />

          {p.case_id && (
            <p className="routing__idle routing__sanctioned">
              Sanctioned {fmt.date(p.decided_on)}. The acquisition file is{' '}
              <Link to={`/cases/${p.case_id}`}>{p.case_number}</Link>.
            </p>
          )}

          {move.error && (
            <p className="routing__idle routing__failed" role="alert">
              {move.error.message}
            </p>
          )}

          {p.allowed_transitions.length > 0 ? (
            <div className="routing__actions">
              <label className="routing__where" htmlFor="transition-note">
                Note
              </label>
              <textarea
                id="transition-note"
                className="routing__note"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (noteError) setNoteError(null);
                }}
                maxLength={500}
                placeholder="Recorded against this hand-off, and read by every office the file passes through."
              />
              {noteError && (
                <span className="field__error" role="alert">
                  {noteError}
                </span>
              )}
              {p.allowed_transitions.map((status) => {
                const action = ACTION[status] || { label: proposalStatusLabel(status) };
                return (
                  <Button
                    key={status}
                    variant={action.variant || 'quiet'}
                    onClick={() => onAction(status)}
                    disabled={move.pending}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="routing__idle">
              {p.case_id
                ? 'This proposal has been sanctioned and the file has moved on.'
                : `Nothing to do here — the file is with ${p.held_by.toLowerCase()}.`}
            </p>
          )}
        </aside>
      </div>

      {/* Sanction and rejection are the two moves that cannot be taken back:
          one mints a case, the other ends the proposal. Those get the confirm
          step. Submitting and taking up for scrutiny do not — a confirm on
          every button teaches people to click through all of them. */}
      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        busy={move.pending}
        title={confirming === 'approved' ? 'Sanction this proposal?' : 'Reject this proposal?'}
        subtitle={p.proposal_number}
        error={move.error}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(null)} disabled={move.pending}>
              Cancel
            </Button>
            <Button onClick={() => apply(confirming)} disabled={move.pending}>
              {move.pending ? 'Recording…' : confirming === 'approved' ? 'Sanction it' : 'Reject it'}
            </Button>
          </>
        }
      >
        {confirming === 'approved' ? (
          <p>
            Sanctioning opens an acquisition case at preliminary notification under
            Section 11, numbered in the {p.district_name} series, and starts its
            statutory clock. The proposal cannot be reopened afterwards.
          </p>
        ) : (
          <p>
            Rejection ends this proposal. If the requiring body should be able to
            correct it and send it back, return it for revision instead.
          </p>
        )}
        {note.trim() && <p className="trail__note">Note: {note.trim()}</p>}
      </Modal>
    </>
  );
}
