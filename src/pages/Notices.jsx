import { useMemo, useState } from 'react';
import * as noticesApi from '../api/notices';
import { useApi, useMutation } from '../hooks/useApi';
import * as fmt from '../lib/format';
import { stageLabel, stageSection } from '../lib/labels';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import StatusBadge from '../components/case/StatusBadge';
import Button from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import '../components/public/public.css';

/* A 14-character alphanumeric string reads as a ULPIN; anything else is
   treated as a survey number. Kept as one box rather than two fields —
   nobody filing this from memory knows in advance which one they have. */
const ULPIN_RE = /^[A-Za-z0-9]{14}$/;

const PAYMENT_LABEL = {
  not_yet_declared: 'Award not yet declared',
  not_yet_paid: 'Awarded, not yet paid',
  partially_paid: 'Partially paid',
  paid: 'Paid in full',
};

function LookupCard() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const search = useMutation((q) =>
    ULPIN_RE.test(q) ? noticesApi.lookup({ ulpin: q }) : noticesApi.lookup({ survey_number: q }),
  );

  async function onSubmit(event) {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      setResult(await search.run(query.trim()));
    } catch {
      setResult(null);
    }
  }

  return (
    <section className="notice-lookup">
      <h2 className="notice-lookup__title">Find your land</h2>
      <p className="notice-lookup__lede">
        Enter the survey number or the fourteen-character ULPIN and see what stage the
        acquisition has reached, whether the award has been paid, and how many objections
        on the case have been resolved. No sign-in, and nothing here beyond what is
        already on the public record.
      </p>

      <form className="notice-lookup__form" onSubmit={onSubmit}>
        <Input
          label="Survey number or ULPIN"
          value={query}
          placeholder="127/2A or IN000000000281"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={search.pending}>
          {search.pending ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {search.error && <ErrorState error={search.error} title="The lookup failed" />}

      {result && !result.found && (
        <Empty
          title="No parcel found"
          body="Check the survey number or ULPIN. Only land already on the public record — notified or declared under the Act — can be found here."
        />
      )}

      {result && result.found && (
        <div className="notice-lookup__result">
          <div className="notice-lookup__result-head">
            <span className="case-number">{result.survey_number}</span>
            <StatusBadge kind="stage" value={result.stage} title={stageSection(result.stage)} />
          </div>
          <dl className="notice-lookup__facts">
            <div>
              <dt>Case</dt>
              <dd>{result.case_number}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{result.village_name}, {result.district_name}</dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>{result.project_name}</dd>
            </div>
            {result.preliminary_notification_on && (
              <div>
                <dt>Notified</dt>
                <dd>{fmt.date(result.preliminary_notification_on)}</dd>
              </div>
            )}
            {result.declaration_on && (
              <div>
                <dt>Declared</dt>
                <dd>{fmt.date(result.declaration_on)}</dd>
              </div>
            )}
            <div>
              <dt>Award</dt>
              <dd>
                {result.award_declared ? fmt.rupees(result.award_amount) : 'Not yet declared'}
              </dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{PAYMENT_LABEL[result.payment_status] || result.payment_status}</dd>
            </div>
            <div>
              <dt>Possession</dt>
              <dd>{result.possession_taken ? 'Taken' : 'Not yet taken'}</dd>
            </div>
            <div>
              <dt>Objections</dt>
              <dd>
                {result.objection_count === 0
                  ? 'None filed'
                  : `${result.objections_resolved} of ${result.objection_count} decided`}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

/* The public notice board.

   Publishing notifications publicly is a statutory requirement under the
   Act, not decoration. A notice is a case that has reached one of the two
   stages the Act requires be published — Section 11 preliminary notification
   and Section 19 declaration — so this reads the real caseload rather than a
   parallel table of invented announcements. Nothing here is authenticated:
   a public notice is public. */

const PUBLISHED_STAGES = ['preliminary_notification', 'declaration'];

const STAGE_NOTE = {
  preliminary_notification:
    'Notified under Section 11. Objections may be filed within sixty days of publication.',
  declaration:
    'Declared under Section 19. The award follows; compensation and resettlement are determined from this point.',
};

export default function Notices() {
  const [stage, setStage] = useState('');
  const [districtId, setDistrictId] = useState('');

  const notices = useApi(
    (opts) =>
      noticesApi.list(
        { stage: stage || undefined, limit: 100 },
        opts,
      ),
    [stage],
  );

  /* The district list comes off the notices themselves rather than
     /districts, which needs a token. A public page makes no authenticated
     calls at all. */
  const districtOptions = useMemo(() => {
    const seen = new Map();
    for (const notice of (notices.data && notices.data.items) || []) {
      seen.set(notice.district_name, notice.district_name);
    }
    return [...seen.keys()].sort().map((name) => ({ value: name, label: name }));
  }, [notices.data]);

  /* The API filters by district id; this page only knows names, so the
     narrowing happens here. The list is at most a hundred rows. */
  const visible = useMemo(() => {
    const items = (notices.data && notices.data.items) || null;
    if (!items) return null;
    return districtId ? items.filter((n) => n.district_name === districtId) : items;
  }, [notices.data, districtId]);

  return (
    <div className="public">
      <PublicHeader />

      <main className="public-page" id="main">
        <h1 className="public-page__title">Public notices</h1>
        <div className="public-page__rule" aria-hidden="true" />

        <p className="public-page__lede">
          Every acquisition that has been notified under Section 11 or declared
          under Section 19, published as the Act requires. If land recorded in
          your name appears here, the district office holds the full record and
          the period for filing an objection runs from the date of publication.
        </p>

        <LookupCard />

        <div className="public-page__filters" style={{ marginTop: 'var(--s6)' }}>
          <Select
            label="Stage"
            value={stage}
            placeholder="Notified and declared"
            options={PUBLISHED_STAGES.map((value) => ({ value, label: stageLabel(value) }))}
            onChange={(event) => setStage(event.target.value)}
          />
          <Select
            label="District"
            value={districtId}
            placeholder="All districts"
            options={districtOptions}
            onChange={(event) => setDistrictId(event.target.value)}
          />
        </div>

        {notices.loading && <Loading label="Loading notices" rows={6} />}
        {notices.error && <ErrorState error={notices.error} onRetry={notices.reload} />}

        {visible && visible.length === 0 && (
          <Empty
            title="No notices published"
            body={
              districtId || stage
                ? 'Nothing has been published under these filters. Widen them to see the rest.'
                : 'No acquisition has reached a stage the Act requires be published.'
            }
          />
        )}

        {visible &&
          visible.map((notice) => (
            <article key={notice.case_number} className="notice">
              <div>
                <p className="notice__date">{fmt.dateLong(notice.published_on)}</p>
                <p className="notice__date" style={{ marginTop: 4 }}>
                  {notice.case_number}
                </p>
              </div>

              <div>
                <h2 className="notice__title">{notice.title}</h2>
                <p className="notice__meta">
                  {notice.village_name}, {notice.district_name} · {notice.project_name}
                </p>
                <p className="notice__meta">Requiring body: {notice.requiring_body}</p>
                <p className="notice__meta">
                  {fmt.count(notice.parcel_count)} parcels ·{' '}
                  {fmt.hectares(notice.total_area_ha)}
                </p>
                <p className="notice__meta" style={{ marginTop: 'var(--s2)' }}>
                  {STAGE_NOTE[notice.stage]}
                </p>
              </div>

              <div className="notice__stage">
                <StatusBadge kind="stage" value={notice.stage} title={stageSection(notice.stage)} />
              </div>
            </article>
          ))}
      </main>

      <PublicFooter />
    </div>
  );
}
