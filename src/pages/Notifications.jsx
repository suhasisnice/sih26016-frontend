import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as notificationsApi from '../api/notifications';
import { useApi, useMutation } from '../hooks/useApi';
import * as fmt from '../lib/format';
import { ruleLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import './notifications.css';

/* Addressed correspondence, not a dashboard panel.

   The dashboard's alert list is the same underlying rule output, but it is
   the district's alerts — anyone who opens the dashboard sees them. These are
   this officer's, they persist until dealt with, and nobody else can read
   them. That is the distinction the two screens exist to keep.

   Newest first, because an inbox is read as "what has happened since I last
   looked". The case list is oldest-first for the opposite reason. */

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export default function Notifications() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severity, setSeverity] = useState('');

  const inbox = useApi(
    (opts) =>
      notificationsApi.list(
        { unread_only: unreadOnly || undefined, severity: severity || undefined, limit: 100 },
        opts,
      ),
    [unreadOnly, severity],
  );

  const mark = useMutation((ids) => notificationsApi.markRead(ids));

  async function open(item) {
    /* Reading it is what marks it read — there is no separate tick to click.
       The navigation does not wait on the write: a slow mark-read should not
       hold up the case the officer asked for. */
    if (!item.is_read) mark.run([item.id]).then(() => inbox.reload(), () => {});
    if (item.case_id) navigate(`/cases/${item.case_id}`);
  }

  async function markAll() {
    try {
      await mark.run(null);
      inbox.reload();
    } catch {
      /* useMutation holds it; rendered above the list. */
    }
  }

  const unread = inbox.data ? inbox.data.unread_count : 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Raised against cases in your charge by the rules that run each night."
        actions={
          unread > 0 && (
            <Button variant="quiet" onClick={markAll} disabled={mark.pending}>
              {mark.pending ? 'Marking…' : `Mark all ${fmt.count(unread)} read`}
            </Button>
          )
        }
      />

      <div className="inbox__filters">
        <div className="inbox__toggle" role="group" aria-label="Filter by read state">
          <button
            type="button"
            className={`inbox__tab${unreadOnly ? '' : ' is-active'}`}
            onClick={() => setUnreadOnly(false)}
            aria-pressed={!unreadOnly}
          >
            All
          </button>
          <button
            type="button"
            className={`inbox__tab${unreadOnly ? ' is-active' : ''}`}
            onClick={() => setUnreadOnly(true)}
            aria-pressed={unreadOnly}
          >
            Unread{unread > 0 ? ` (${fmt.count(unread)})` : ''}
          </button>
        </div>

        <div className="inbox__toggle" role="group" aria-label="Filter by severity">
          <button
            type="button"
            className={`inbox__tab${severity === '' ? ' is-active' : ''}`}
            onClick={() => setSeverity('')}
            aria-pressed={severity === ''}
          >
            Any severity
          </button>
          {SEVERITIES.map((value) => (
            <button
              key={value}
              type="button"
              className={`inbox__tab${severity === value ? ' is-active' : ''}`}
              onClick={() => setSeverity(severity === value ? '' : value)}
              aria-pressed={severity === value}
            >
              <StatusBadge kind="severity" value={value} />
            </button>
          ))}
        </div>
      </div>

      {mark.error && <ErrorState error={mark.error} title="That could not be marked read" />}

      {inbox.loading && <Loading label="Loading your notifications" rows={5} />}
      {inbox.error && <ErrorState error={inbox.error} onRetry={inbox.reload} />}

      {inbox.data && inbox.data.items.length === 0 && (
        <Empty
          title={unreadOnly ? 'Nothing unread' : 'Nothing here'}
          body={
            unreadOnly
              ? 'Everything addressed to you has been read.'
              : 'No rule has raised anything against a case in your charge.'
          }
        />
      )}

      {inbox.data && inbox.data.items.length > 0 && (
        <ul className="inbox">
          {inbox.data.items.map((item) => (
            <li
              key={item.id}
              className={`inbox__item is-${item.severity}${item.is_read ? '' : ' is-unread'}`}
            >
              <button type="button" className="inbox__row" onClick={() => open(item)}>
                <span className="inbox__mark" aria-hidden="true" />
                <span className="inbox__text">
                  <span className="inbox__head">
                    <span className="inbox__title">{item.title}</span>
                    {/* Only rule-engine findings have a rule. A case-update
                        notification (an objection answered, a stage moved)
                        legitimately has none — rendering ruleLabel(null)
                        there put an em dash where a name goes, which reads
                        as a missing value rather than an absent one. */}
                    {item.rule && <span className="inbox__rule">{ruleLabel(item.rule)}</span>}
                    <span className="inbox__when">{fmt.dateTime(item.created_at)}</span>
                  </span>
                  <span className="inbox__body">{item.body}</span>
                  {item.case_number && (
                    <span className="inbox__case">{item.case_number}</span>
                  )}
                </span>
                <StatusBadge kind="severity" value={item.severity} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {inbox.data && inbox.data.total > inbox.data.items.length && (
        <p className="inbox__foot">
          Showing the most recent {inbox.data.items.length} of {fmt.count(inbox.data.total)}.
        </p>
      )}
    </>
  );
}
