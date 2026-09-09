import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  Download,
  FileText,
  MapPin,
  MessageSquareWarning,
  Sprout,
} from 'lucide-react';
import * as casesApi from '../api/cases';
import * as parcelsApi from '../api/parcels';
import * as personsApi from '../api/persons';
import * as documentsApi from '../api/documents';
import * as grievancesApi from '../api/grievances';
import * as objectionsApi from '../api/objections';
import * as notificationsApi from '../api/notifications';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { STAGE_RESPONSIBLE_ROLE } from '../auth/permissions';
import * as fmt from '../lib/format';
import {
  compensationStatusLabel,
  docTypeLabel,
  grievanceStatusLabel,
  roleLabel,
  stageLabel,
} from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StageTimeline from '../components/case/StageTimeline';
import KpiTile from '../components/dashboard/KpiTile';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import './landownerdashboard.css';

const MyLandMap = lazy(() => import('../components/landowner/MyLandMap'));

/* Short, plain-language descriptions for "What does this mean?" — content
   only, no legal advice, kept deliberately neutral. Mirrors the stage set
   in app.core.enums.Stage / lib/labels.js's own STAGE table. */
const STAGE_EXPLANATION = {
  preliminary_notification:
    'The government has formally announced its intention to acquire land in this area.',
  social_impact_assessment:
    'A study is being carried out to understand how the acquisition will affect the people and families living here.',
  land_verification:
    'Officials are checking parcel boundaries, ownership records and survey details on the ground.',
  objection_period:
    'Landowners may formally raise concerns about the acquisition during this window.',
  declaration: 'The government has confirmed that this land will be acquired.',
  award: 'The compensation amount for the affected land has been determined or is being processed.',
  rehabilitation_resettlement:
    'Support for affected families — housing, land or other entitlements — is being arranged.',
  possession: 'The government is taking physical possession of the acquired land.',
  monitoring: 'The acquisition is complete and is being tracked for any follow-up requirements.',
};

/* Areas a parcel counts toward "acquired" versus "remaining", derived from
   ParcelStatus — never a separate stored figure, so it can never drift
   from the parcel rows themselves. */
const ACQUIRED_STATUSES = ['acquired', 'possession_taken'];

export default function LandownerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [reportPending, setReportPending] = useState(false);
  const [reportError, setReportError] = useState(null);

  const myCases = useApi((opts) => casesApi.list({ limit: 100 }, opts), []);

  const cases = (myCases.data && myCases.data.items) || [];
  // Most recently changed first — the acquisition most likely to need the
  // landowner's attention right now, if they were not asked to pick one.
  const orderedCases = useMemo(
    () => [...cases].sort((a, b) => (a.stage_changed_at < b.stage_changed_at ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myCases.data],
  );
  const activeCaseId = selectedCaseId || (orderedCases[0] && orderedCases[0].id);

  const detail = useApi(
    (opts) => (activeCaseId ? casesApi.get(activeCaseId, opts) : Promise.resolve(null)),
    [activeCaseId],
    { skip: !activeCaseId },
  );
  const parcels = useApi(
    (opts) => (activeCaseId ? parcelsApi.forCase(activeCaseId, opts) : Promise.resolve([])),
    [activeCaseId],
    { skip: !activeCaseId },
  );
  const people = useApi(
    (opts) => (activeCaseId ? personsApi.forCase(activeCaseId, opts) : Promise.resolve(null)),
    [activeCaseId],
    { skip: !activeCaseId },
  );
  const documents = useApi(
    (opts) => (activeCaseId ? documentsApi.forCase(activeCaseId, opts) : Promise.resolve(null)),
    [activeCaseId],
    { skip: !activeCaseId },
  );
  const grievances = useApi(
    (opts) => (activeCaseId ? grievancesApi.list({ case_id: activeCaseId }, opts) : Promise.resolve(null)),
    [activeCaseId],
    { skip: !activeCaseId },
  );
  const objections = useApi(
    (opts) => (activeCaseId ? objectionsApi.list({ case_id: activeCaseId }, opts) : Promise.resolve(null)),
    [activeCaseId],
    { skip: !activeCaseId },
  );
  const notifications = useApi((opts) => notificationsApi.list({ limit: 5 }, opts), []);

  if (myCases.loading) return <Loading label="Loading your acquisition" rows={8} />;
  if (myCases.error) return <ErrorState error={myCases.error} onRetry={myCases.reload} />;

  if (cases.length === 0) {
    return (
      <>
        <PageHeader title="My Land Acquisition" />
        <Empty
          center
          title="No acquisition case on file"
          body="No land acquisition currently records land in your name. If you believe that is wrong, the district office holds the land records."
        />
      </>
    );
  }

  const c = detail.data;
  const myPerson =
    people.data && user.person_id
      ? people.data.items.find((p) => p.person_id === user.person_id)
      : null;

  const totalArea = (parcels.data || []).reduce((sum, p) => sum + p.area_ha, 0);
  const acquiredArea = (parcels.data || [])
    .filter((p) => ACQUIRED_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + p.area_ha, 0);
  const remainingArea = Math.max(0, totalArea - acquiredArea);

  const openGrievances = grievances.data
    ? grievances.data.items.filter((g) => g.status !== 'resolved' && g.status !== 'closed')
    : [];
  const infoRequiredGrievance = openGrievances.find((g) => g.status === 'info_required');

  const hasFiledObjection = objections.data ? objections.data.items.length > 0 : true;
  const inObjectionPeriod = c && c.stage === 'objection_period';

  async function onDownloadReport() {
    setReportError(null);
    setReportPending(true);
    try {
      await casesApi.downloadReport(c.id, c.case_number);
    } catch {
      setReportError('Could not generate the report. Please try again.');
    } finally {
      setReportPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Land Acquisition"
        subtitle="Bhoomimitra — Landowner Portal"
        actions={
          c && (
            <Button variant="quiet" onClick={onDownloadReport} disabled={reportPending}>
              <Download size={14} strokeWidth={1.75} aria-hidden="true" style={{ marginRight: 6 }} />
              {reportPending ? 'Preparing…' : 'Download case status report'}
            </Button>
          )
        }
      />
      {reportError && (
        <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 var(--s3)' }}>
          {reportError}
        </p>
      )}

      {orderedCases.length > 1 && (
        <div className="myland-case-switch">
          <span className="myland-case-switch__label">Acquisition case:</span>
          {orderedCases.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`myland-case-switch__pill${item.id === activeCaseId ? ' is-active' : ''}`}
              onClick={() => setSelectedCaseId(item.id)}
            >
              {item.case_number}
            </button>
          ))}
        </div>
      )}

      {detail.loading && <Loading label="Loading case details" rows={6} />}
      {detail.error && <ErrorState error={detail.error} onRetry={detail.reload} />}

      {c && (
        <>
          <section className="panel myland-summary">
            <dl className="myland-summary__facts">
              <div>
                <dt>Case reference</dt>
                <dd className="case-number">{c.case_number}</dd>
              </div>
              <div>
                <dt>Current status</dt>
                <dd>{stageLabel(c.stage)}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{c.project_name}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {c.village_name}, {c.district_name}
                </dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{fmt.date(c.stage_changed_at)}</dd>
              </div>
            </dl>
          </section>

          <div className="kpis myland-kpis">
            <Link to="#my-land" className="myland-kpi-link">
              <KpiTile label="Land" value={fmt.hectaresPlain(totalArea)} unit="ha" icon={MapPin} accent="neutral" />
            </Link>
            <Link to="#compensation" className="myland-kpi-link">
              <KpiTile
                label="Compensation"
                value={myPerson && myPerson.compensation ? compensationStatusLabel(myPerson.compensation.status) : 'None yet'}
                icon={Banknote}
                accent={myPerson && myPerson.compensation && myPerson.compensation.status === 'paid' ? 'ok' : 'neutral'}
              />
            </Link>
            <Link to="#action-required" className="myland-kpi-link">
              <KpiTile
                label="Action required"
                value={infoRequiredGrievance ? '1' : '0'}
                icon={AlertCircle}
                accent={infoRequiredGrievance ? 'warn' : 'ok'}
              />
            </Link>
            <Link to="/grievances" className="myland-kpi-link">
              <KpiTile label="Grievances" value={String(openGrievances.length)} icon={MessageSquareWarning} accent={openGrievances.length ? 'warn' : 'neutral'} />
            </Link>
          </div>

          <section className="panel myland-section">
            <div className="panel__head">
              <h2 className="panel__title">Acquisition progress</h2>
            </div>
            <StageTimeline stage={c.stage} history={c.stage_history} />
            <p className="myland-stage-explain">
              <strong>{stageLabel(c.stage)}.</strong> {STAGE_EXPLANATION[c.stage]}
            </p>
          </section>

          <section className="panel myland-section" id="action-required">
            <div className="panel__head">
              <h2 className="panel__title">Action required</h2>
            </div>
            {infoRequiredGrievance ? (
              <div className="myland-action">
                <p className="myland-action__title">Additional information needed</p>
                <p className="myland-action__body">
                  The office needs more information from you on grievance{' '}
                  <strong>{infoRequiredGrievance.grievance_number}</strong> ({infoRequiredGrievance.subject}).
                </p>
                <Button variant="primary" onClick={() => navigate(`/grievances/${infoRequiredGrievance.id}`)}>
                  View grievance
                </Button>
              </div>
            ) : inObjectionPeriod && !hasFiledObjection ? (
              <div className="myland-action">
                <p className="myland-action__title">Objection period is open</p>
                <p className="myland-action__body">
                  Your case is currently in the objection period. If you have concerns about this
                  acquisition, you may raise a formal objection.
                </p>
                <Button variant="secondary" onClick={() => navigate(`/cases/${c.id}`)}>
                  Open case to file an objection
                </Button>
              </div>
            ) : (
              <Empty center title="No action required" body="No action required at this time." />
            )}
          </section>

          <section className="panel myland-section" id="my-land">
            <div className="panel__head">
              <h2 className="panel__title">My land</h2>
            </div>
            {parcels.loading && <Loading label="Loading parcels" rows={2} />}
            {parcels.error && <ErrorState error={parcels.error} onRetry={parcels.reload} />}
            {parcels.data && parcels.data.length === 0 && (
              <Empty center title="No parcel on file" body="No parcel has been recorded against you on this case yet." />
            )}
            {parcels.data && parcels.data.length > 0 && (
              <>
                <dl className="myland-summary__facts">
                  <div>
                    <dt>Survey number(s)</dt>
                    <dd>{parcels.data.map((p) => p.survey_number).join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Village</dt>
                    <dd>{c.village_name}</dd>
                  </div>
                  <div>
                    <dt>District</dt>
                    <dd>{c.district_name}</dd>
                  </div>
                  <div>
                    <dt>Total area</dt>
                    <dd>{fmt.hectares(totalArea)}</dd>
                  </div>
                  <div>
                    <dt>Acquired</dt>
                    <dd>{fmt.hectares(acquiredArea)}</dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{fmt.hectares(remainingArea)}</dd>
                  </div>
                </dl>

                <h3 className="myland-subhead">My land on map</h3>
                <Suspense fallback={<Loading label="Loading the map" rows={3} />}>
                  <MyLandMap caseId={c.id} />
                </Suspense>
              </>
            )}
          </section>

          <section className="panel myland-section" id="compensation">
            <div className="panel__head">
              <h2 className="panel__title">Compensation</h2>
            </div>
            {!myPerson || !myPerson.compensation ? (
              <Empty center title="Not available yet" body="Compensation information is not available yet." />
            ) : (
              <>
                <dl className="myland-summary__facts">
                  <div>
                    <dt>Indicative amount</dt>
                    <dd>{fmt.rupees(myPerson.compensation.amount_awarded)}</dd>
                  </div>
                  <div>
                    <dt>Paid so far</dt>
                    <dd>{fmt.rupees(myPerson.compensation.amount_paid)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{compensationStatusLabel(myPerson.compensation.status)}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{fmt.date(myPerson.compensation.awarded_on)}</dd>
                  </div>
                </dl>
                {myPerson.compensation.status !== 'paid' && (
                  <p className="myland-disclaimer">
                    This amount is indicative and subject to official assessment and award.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="panel myland-section" id="documents">
            <div className="panel__head">
              <h2 className="panel__title">My documents</h2>
            </div>
            {documents.loading && <Loading label="Loading documents" rows={3} />}
            {documents.error && <ErrorState error={documents.error} onRetry={documents.reload} />}
            {documents.data && documents.data.items.length === 0 && (
              <Empty center title="No documents yet" body="No documents are currently available." />
            )}
            {documents.data && documents.data.items.length > 0 && (
              <ul className="myland-doclist">
                {documents.data.items.map((d) => (
                  <li key={d.id} className="myland-doclist__item">
                    <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span className="myland-doclist__body">
                      <span className="myland-doclist__name">{docTypeLabel(d.doc_type)}</span>
                      <span className="myland-doclist__meta">{fmt.date(d.uploaded_on)}</span>
                    </span>
                    <Button variant="quiet" onClick={() => documentsApi.download(d.id, d.filename)}>
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel myland-section" id="notifications">
            <div className="panel__head">
              <h2 className="panel__title">Notifications</h2>
              <Link to="/notifications" className="myland-panel-link">
                View all
              </Link>
            </div>
            {notifications.loading && <Loading label="Loading notifications" rows={3} />}
            {notifications.data && notifications.data.items.length === 0 && (
              <Empty center title="Nothing yet" body="You have no notifications yet." />
            )}
            {notifications.data && notifications.data.items.length > 0 && (
              <ul className="myland-notiflist">
                {notifications.data.items.map((n) => (
                  <li key={n.id} className="myland-notiflist__item">
                    <span className={`myland-notiflist__dot${n.is_read ? '' : ' is-unread'}`} aria-hidden="true" />
                    <span className="myland-notiflist__body">
                      <span className="myland-notiflist__title">{n.title}</span>
                      <span className="myland-notiflist__date">{fmt.date(n.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel myland-section" id="grievances">
            <div className="panel__head">
              <h2 className="panel__title">Grievances</h2>
              <Button variant="primary" onClick={() => navigate('/grievances/new')}>
                Raise grievance
              </Button>
            </div>
            {grievances.loading && <Loading label="Loading grievances" rows={2} />}
            {grievances.data && grievances.data.items.length === 0 && (
              <Empty center title="No grievances" body="You have not submitted any grievances." />
            )}
            {grievances.data && grievances.data.items.length > 0 && (
              <ul className="myland-doclist">
                {grievances.data.items.slice(0, 5).map((g) => (
                  <li key={g.id} className="myland-doclist__item">
                    <MessageSquareWarning size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span className="myland-doclist__body">
                      <span className="myland-doclist__name">
                        {g.grievance_number} — {g.subject}
                      </span>
                      <span className="myland-doclist__meta">{grievanceStatusLabel(g.status)}</span>
                    </span>
                    <Button variant="quiet" onClick={() => navigate(`/grievances/${g.id}`)}>
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/grievances" className="myland-panel-link" style={{ display: 'inline-block', marginTop: 'var(--s3)' }}>
              See all my grievances
            </Link>
          </section>

          <section className="panel myland-section" id="case-officer">
            <div className="panel__head">
              <h2 className="panel__title">Case officer</h2>
            </div>
            <dl className="myland-summary__facts">
              <div>
                <dt>Responsible office</dt>
                <dd>{roleLabel(STAGE_RESPONSIBLE_ROLE[c.stage] || 'slao')}</dd>
              </div>
            </dl>
            <p className="myland-note">
              Contact information is not available through the portal at this time. For queries, use
              Help &amp; Support below.
            </p>
          </section>

          <section className="panel myland-section" id="hearing">
            <div className="panel__head">
              <h2 className="panel__title">Hearing</h2>
            </div>
            <Empty center title="No hearing scheduled" body="No hearing has been scheduled." />
          </section>

          <section className="panel myland-section" id="case-history">
            <div className="panel__head">
              <h2 className="panel__title">Case history</h2>
            </div>
            {c.stage_history.length === 0 ? (
              <Empty center title="No history yet" body="No stage changes have been recorded on this case yet." />
            ) : (
              <ul className="myland-history">
                {[...c.stage_history].reverse().map((h, index) => (
                  <li key={`${h.to_stage}-${h.changed_on}-${index}`} className="myland-history__item">
                    <span className="myland-history__date">{fmt.date(h.changed_on)}</span>
                    <span className="myland-history__text">
                      {stageLabel(h.to_stage)} {h.from_stage ? `— moved from ${stageLabel(h.from_stage)}` : '— case opened'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel myland-section" id="help">
            <div className="panel__head">
              <h2 className="panel__title">Help &amp; support</h2>
            </div>
            <ul className="myland-help">
              <li>
                <strong>What is land acquisition?</strong> The government identifies land needed for a
                public project and follows a fixed set of legal stages — from notification through to
                possession — before taking it.
              </li>
              <li>
                <strong>What documents will I need?</strong> Ownership proof and land records are the
                most common. The Documents section above lists what is on file for your case.
              </li>
              <li>
                <strong>Something wrong with your case?</strong> Use{' '}
                <Link to="/grievances/new">Raise a grievance</Link> to tell the office about it.
              </li>
              <li>
                <Sprout size={14} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
                <Link to="/support">Visit the Support page</Link> for further help.
              </li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}
