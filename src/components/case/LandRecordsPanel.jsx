import * as integrationsApi from '../../api/integrations';
import { useApi } from '../../hooks/useApi';
import * as fmt from '../../lib/format';
import Loading from '../states/Loading';
import ErrorState from '../states/ErrorState';
import Empty from '../states/Empty';

/* Read-only comparison against the state land-record portal. Everything
   here is simulated unless `is_live` says otherwise, and that has to be
   impossible to miss — a demo that cannot tell you its data is simulated is
   a demo that is lying. Nothing here writes to a parcel; a disagreement is
   an officer's decision through the ordinary audited route, never something
   this lookup resolves on their behalf. */
const STATUS_TONE = {
  matched: 'ok',
  area_mismatch: 'warn',
  owner_mismatch: 'warn',
  not_found_upstream: 'danger',
  unavailable: 'idle',
};

const STATUS_LABEL = {
  matched: 'Matches the upstream record',
  area_mismatch: 'Area differs from the upstream record',
  owner_mismatch: 'Recorded owner differs upstream',
  not_found_upstream: 'Not found in the upstream record',
  unavailable: 'Upstream record unavailable',
};

export default function LandRecordsPanel({ caseId }) {
  const report = useApi((opts) => integrationsApi.reconcile(caseId, opts), [caseId]);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">External land records</h2>
        {report.data && (
          <span className="panel__count">
            {report.data.needs_attention} of {report.data.parcels_checked} need attention
          </span>
        )}
      </div>

      {report.loading && <Loading inline rows={3} />}
      {report.error && <ErrorState error={report.error} onRetry={report.reload} />}

      {report.data && (
        <>
          <div className={`landrec__source${report.data.is_live ? '' : ' is-simulated'}`}>
            <span>{report.data.provider_label}</span>
            {!report.data.is_live && <span className="landrec__badge">Simulated</span>}
            {report.data.village_lgd && (
              <span className="landrec__lgd">LGD {report.data.village_lgd}</span>
            )}
          </div>

          {report.data.items.length === 0 ? (
            <Empty
              title="No parcels to check"
              body="Attach at least one parcel to run a comparison against the land-record portal."
            />
          ) : (
            <div className="landrec__list">
              {report.data.items.map((item) => (
                <div
                  key={item.parcel_id}
                  className={`landrec__row is-${STATUS_TONE[item.status] || 'idle'}`}
                >
                  <div className="landrec__row-head">
                    <span className="case-number">{item.survey_number}</span>
                    <span className="landrec__status">{STATUS_LABEL[item.status] || item.status}</span>
                  </div>

                  <dl className="landrec__compare">
                    <div>
                      <dt>On file</dt>
                      <dd>
                        {item.local_owner_name} · {fmt.hectaresPlain(item.local_area_ha)} ha
                      </dd>
                    </div>
                    <div>
                      <dt>Upstream</dt>
                      <dd>
                        {item.upstream_owner_name || '—'}
                        {item.upstream_area_ha !== null && item.upstream_area_ha !== undefined
                          ? ` · ${fmt.hectaresPlain(item.upstream_area_ha)} ha`
                          : ''}
                      </dd>
                    </div>
                  </dl>

                  {item.note && <p className="landrec__note">{item.note}</p>}

                  <div className="landrec__meta">
                    {item.land_classification && <span>{item.land_classification}</span>}
                    {item.mutation_pending && <span className="is-warn">Mutation pending</span>}
                    {item.record_as_of && <span>As of {fmt.date(item.record_as_of)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
