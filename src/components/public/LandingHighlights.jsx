import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as noticesApi from '../../api/notices';
import { useApi } from '../../hooks/useApi';
import * as fmt from '../../lib/format';
import { stageSection } from '../../lib/labels';
import StatusBadge from '../case/StatusBadge';

/* Real figures, not marketing copy: both bands read the same public notice
   board Notices.jsx does — nothing here is invented for the landing page.
   A quiet failure mode on purpose. This is a highlight reel sitting between
   the hero and the statement band, not a page of its own — if the request
   fails there is no case for a full ErrorState, just fewer numbers on
   screen until a reload works. */
export default function LandingHighlights() {
  const notices = useApi(
    (opts) => noticesApi.list({ limit: 200 }, opts),
    [],
  );

  const items = useMemo(() => (notices.data && notices.data.items) || [], [notices.data]);

  const stats = useMemo(() => {
    if (!items.length) return null;
    const totalHectares = items.reduce((sum, n) => sum + (Number(n.total_area_ha) || 0), 0);
    const districts = new Set(items.map((n) => n.district_name));
    return {
      notices: notices.data.total ?? items.length,
      hectares: totalHectares,
      districts: districts.size,
    };
  }, [items, notices.data]);

  const recent = items.slice(0, 3);

  if (!notices.loading && !notices.error && !items.length) return null;

  return (
    <>
      <section className="stats-band" aria-label="Platform activity">
        <div className="stats-band__grid">
          <div className="stat">
            <span className="stat__value">
              {stats ? fmt.count(stats.notices) : '—'}
            </span>
            <span className="stat__label">Notices published</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              {stats ? stats.hectares.toFixed(2) : '—'}
              <span className="stat__value-unit">ha</span>
            </span>
            <span className="stat__label">Land under acquisition</span>
          </div>
          <div className="stat">
            <span className="stat__value">{stats ? fmt.count(stats.districts) : '—'}</span>
            <span className="stat__label">Districts covered</span>
          </div>
        </div>
      </section>

      {(notices.loading || recent.length > 0) && (
        <section className="updates">
          <div className="updates__head">
            <h2 className="updates__title">Latest notices</h2>
            <Link to="/notices" className="updates__all">View all notices</Link>
          </div>

          <div className="updates__grid">
            {notices.loading && !recent.length
              ? [0, 1, 2].map((i) => <div key={i} className="update-card update-card--loading" />)
              : recent.map((notice) => (
                  <Link key={notice.case_number} to="/notices" className="update-card">
                    <p className="update-card__date">{fmt.dateLong(notice.published_on)}</p>
                    <h3 className="update-card__title">{notice.title}</h3>
                    <p className="update-card__meta">
                      {notice.village_name}, {notice.district_name}
                    </p>
                    <div className="update-card__status">
                      <StatusBadge
                        kind="stage"
                        value={notice.stage}
                        title={stageSection(notice.stage)}
                      />
                    </div>
                  </Link>
                ))}
          </div>
        </section>
      )}
    </>
  );
}
