import { useParams } from 'react-router-dom';
import * as parcelsApi from '../api/parcels';
import * as casesApi from '../api/cases';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import * as fmt from '../lib/format';
import { stageLabel } from '../lib/labels';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import Button from '../components/ui/Button';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import '../components/case/case.css';

/* Survey number, recorded owner, area, and the case it belongs to.

   Reached from the map popup and from the parcels table on a case. Small on
   purpose — everything else about this land lives on the case, and this page
   links there rather than reproducing it. */
export default function ParcelDetail() {
  const { parcelId } = useParams();
  const { user } = useAuth();

  const parcel = useApi((opts) => parcelsApi.get(parcelId, opts), [parcelId]);

  const linkedCase = useApi(
    (opts) => casesApi.get(parcel.data.case_id, opts),
    [parcel.data && parcel.data.case_id],
    { skip: !parcel.data },
  );

  const mutations = useApi(
    (opts) => parcelsApi.mutationRequests(parcelId, opts),
    [parcelId],
    { skip: !can.createParcel(user) },
  );
  const pushMutation = useMutation(() => parcelsApi.requestMutation(parcelId));

  async function onRequestMutation() {
    try {
      await pushMutation.run();
      mutations.reload();
    } catch {
      /* useMutation holds the error; the panel renders it. */
    }
  }

  if (parcel.loading) return <Loading label="Loading the parcel" rows={6} />;
  if (parcel.error) {
    return (
      <>
        <PageHeader title="Parcel" back={{ to: '/map', label: 'Parcel map' }} />
        <ErrorState error={parcel.error} onRetry={parcel.reload} />
      </>
    );
  }

  const p = parcel.data;

  return (
    <>
      <PageHeader
        back={{ to: '/map', label: 'Parcel map' }}
        title={`Survey number ${p.survey_number}`}
        subtitle="One parcel of land within an acquisition."
        actions={
          <Button to={`/cases/${p.case_id}`} variant="primary">
            Open the case
          </Button>
        }
      />

      <div className="case-detail case-detail--balanced">
        <div className="case-detail__main">
          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">The parcel</h2>
              <StatusBadge kind="parcel" value={p.status} />
            </div>

            <div className="facts">
              <div>
                <p className="fact__label">SURVEY NUMBER</p>
                <p className="fact__value">
                  <span className="case-number">{p.survey_number}</span>
                </p>
              </div>
              <div>
                <p className="fact__label">AREA</p>
                <p className="fact__value">
                  <strong>{fmt.hectaresPlain(p.area_ha)}</strong> ha
                </p>
              </div>
              <div>
                <p className="fact__label">ULPIN</p>
                <p className="fact__value">
                  {p.ulpin ? (
                    <span className="case-number">{p.ulpin}</span>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>Not yet issued</span>
                  )}
                </p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="fact__label">RECORDED OWNER</p>
                <p className="fact__value">{p.owner_name}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="fact__label">LOCATION</p>
                <p className="fact__value" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="case-detail__side">
          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">The acquisition</h2>
            </div>

            {linkedCase.loading && <Loading inline rows={3} />}
            {linkedCase.error && (
              <ErrorState error={linkedCase.error} onRetry={linkedCase.reload} />
            )}

            {linkedCase.data && (
              <div className="facts">
                <div style={{ gridColumn: '1 / -1' }}>
                  <p className="fact__label">CASE</p>
                  <p className="fact__value">
                    <span className="case-number">{linkedCase.data.case_number}</span>
                    <br />
                    {linkedCase.data.title}
                  </p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p className="fact__label">STAGE</p>
                  <p className="fact__value">{stageLabel(linkedCase.data.stage)}</p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p className="fact__label">VILLAGE</p>
                  <p className="fact__value">
                    {linkedCase.data.village_name}, {linkedCase.data.district_name}
                  </p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p className="fact__label">PROJECT</p>
                  <p className="fact__value">{linkedCase.data.project_name}</p>
                </div>
              </div>
            )}
          </section>

          {can.createParcel(user) && (
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Land record mutation</h2>
              </div>

              {p.status !== 'possession_taken' ? (
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  A mutation request can be sent once possession has been taken. This
                  parcel has not reached that stage yet.
                </p>
              ) : (
                <>
                  {pushMutation.error && (
                    <p style={{ fontSize: 12.5, color: 'var(--danger)', marginBottom: 'var(--s3)' }}>
                      {pushMutation.error.message}
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    onClick={onRequestMutation}
                    disabled={pushMutation.pending}
                  >
                    {pushMutation.pending ? 'Sending…' : 'Push mutation request'}
                  </Button>

                  <div style={{ marginTop: 'var(--s4)' }}>
                    {mutations.loading && <Loading inline rows={2} />}
                    {mutations.error && (
                      <ErrorState error={mutations.error} onRetry={mutations.reload} />
                    )}
                    {mutations.data && mutations.data.items.length === 0 && (
                      <Empty title="No request sent yet" />
                    )}
                    {mutations.data && mutations.data.items.length > 0 && (
                      <ol className="doc-history">
                        {mutations.data.items.map((m) => (
                          <li key={m.id} className={m.status === 'acknowledged' ? 'is-current' : ''}>
                            <span className="doc-history__ver">
                              {m.status === 'acknowledged' ? '✓' : m.status === 'failed' ? '✕' : '…'}
                            </span>
                            <span className="doc-history__body">
                              {m.status === 'acknowledged'
                                ? `Acknowledged — ${m.external_ref}`
                                : m.status === 'failed'
                                  ? 'Failed'
                                  : 'Sent'}
                              <br />
                              <span className="doc-history__meta">
                                {fmt.date(m.sent_on)} via {m.adapter}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
