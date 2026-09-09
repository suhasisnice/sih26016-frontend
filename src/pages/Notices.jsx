import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as noticesApi from '../api/notices';
import { useApi, useMutation } from '../hooks/useApi';
import { useI18n } from '../i18n/I18nContext';
import * as fmt from '../lib/format';
import { noticeSection, noticeTypeLabel, stageLabel, stageSection } from '../lib/labels';
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

function LookupCard() {
  const { t } = useI18n();
  const PAYMENT_LABEL = {
    not_yet_declared: t('notices.lookup.paymentNotDeclared'),
    not_yet_paid: t('notices.lookup.paymentNotPaid'),
    partially_paid: t('notices.lookup.paymentPartial'),
    paid: t('notices.lookup.paymentPaid'),
  };
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

  /* Both /notices/subscribe and /notices/provision take the same
     survey_number-or-ulpin identifier the search itself just used —
     whichever the citizen actually typed, echoed straight back rather than
     re-derived from the result (a result with no ulpin on file must still
     be addressable by the survey number that found it). */
  const identifier = ULPIN_RE.test(query.trim())
    ? { ulpin: query.trim() }
    : { survey_number: query.trim() };

  return (
    <section className="notice-lookup">
      <h2 className="notice-lookup__title">{t('notices.lookup.title')}</h2>
      <p className="notice-lookup__lede">{t('notices.lookup.lede')}</p>

      <form className="notice-lookup__form" onSubmit={onSubmit}>
        <Input
          label={t('notices.lookup.fieldLabel')}
          value={query}
          placeholder={t('notices.lookup.fieldPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={search.pending}>
          {search.pending ? t('notices.lookup.searching') : t('notices.lookup.search')}
        </Button>
      </form>

      {search.error && <ErrorState error={search.error} title={t('notices.lookup.failedTitle')} />}

      {result && !result.found && (
        <Empty title={t('notices.lookup.notFoundTitle')} body={t('notices.lookup.notFoundBody')} />
      )}

      {result && result.found && (
        <div className="notice-lookup__result">
          <div className="notice-lookup__result-head">
            <span className="case-number">{result.survey_number}</span>
            <StatusBadge kind="stage" value={result.stage} title={stageSection(result.stage)} />
          </div>
          <dl className="notice-lookup__facts">
            <div>
              <dt>{t('notices.lookup.case')}</dt>
              <dd>{result.case_number}</dd>
            </div>
            {result.ulpin && (
              <div>
                <dt>{t('notices.lookup.ulpin')}</dt>
                <dd>{result.ulpin}</dd>
              </div>
            )}
            <div>
              <dt>{t('notices.lookup.location')}</dt>
              <dd>{result.village_name}, {result.district_name}</dd>
            </div>
            <div>
              <dt>{t('notices.lookup.project')}</dt>
              <dd>{result.project_name}</dd>
            </div>
            {result.requiring_authority && (
              <div>
                <dt>{t('notices.lookup.requiringAuthority')}</dt>
                <dd>{result.requiring_authority}</dd>
              </div>
            )}
            {result.area_ha != null && (
              <div>
                <dt>{t('notices.lookup.area')}</dt>
                <dd>{fmt.hectares(result.area_ha)}</dd>
              </div>
            )}
            {result.preliminary_notification_on && (
              <div>
                <dt>{t('notices.lookup.notified')}</dt>
                <dd>{fmt.date(result.preliminary_notification_on)}</dd>
              </div>
            )}
            {result.declaration_on && (
              <div>
                <dt>{t('notices.lookup.declared')}</dt>
                <dd>{fmt.date(result.declaration_on)}</dd>
              </div>
            )}
            <div>
              <dt>{t('notices.lookup.award')}</dt>
              <dd>
                {result.award_declared
                  ? fmt.rupees(result.award_amount)
                  : t('notices.lookup.awardNotDeclared')}
              </dd>
            </div>
            <div>
              <dt>{t('notices.lookup.payment')}</dt>
              <dd>{PAYMENT_LABEL[result.payment_status] || result.payment_status}</dd>
            </div>
            <div>
              <dt>{t('notices.lookup.possession')}</dt>
              <dd>
                {result.possession_taken
                  ? t('notices.lookup.possessionTaken')
                  : t('notices.lookup.possessionNotTaken')}
              </dd>
            </div>
            <div>
              <dt>{t('notices.lookup.objections')}</dt>
              <dd>
                {result.objection_count === 0
                  ? t('notices.lookup.objectionsNone')
                  : t('notices.lookup.objectionsDecided', result.objections_resolved, result.objection_count)}
              </dd>
            </div>
          </dl>

          <SubscribeSection identifier={identifier} />
          <ProvisionSection identifier={identifier} />
        </div>
      )}
    </section>
  );
}

/* "Get updates about this land" — SMS and/or email, independent of
   whether the citizen ever provisions a login below. Consent is a real
   checkbox, not implied by clicking Subscribe: POST /notices/subscribe
   refuses the request without it. */
function SubscribeSection({ identifier }) {
  const { t } = useI18n();
  const [wantsSms, setWantsSms] = useState(false);
  const [wantsEmail, setWantsEmail] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(null);
  const subscribeMutation = useMutation((payload) => noticesApi.subscribe(payload));

  async function onSubscribe(event) {
    event.preventDefault();
    setDone(null);
    try {
      const result = await subscribeMutation.run({
        ...identifier,
        phone_number: wantsSms ? phoneNumber.trim() : undefined,
        email: wantsEmail ? email.trim() : undefined,
        consent,
      });
      setDone(result);
    } catch {
      /* subscribeMutation.error already carries the message to show */
    }
  }

  const canSubmit =
    consent && ((wantsSms && phoneNumber.trim()) || (wantsEmail && email.trim()));

  return (
    <div className="notice-subscribe">
      <h3 className="notice-subscribe__title">{t('notices.subscribe.title')}</h3>
      <p className="notice-subscribe__lede">{t('notices.subscribe.lede')}</p>

      {done ? (
        <div className="notice-subscribe__done">
          <p className="notice-subscribe__done-title">{t('notices.subscribe.doneTitle')}</p>
          {done.sms_status && (
            <p className="notice-subscribe__channel-result">
              {t('notices.subscribe.sms')} {done.sms_status === 'sent' ? '✓' : '—'}{' '}
              {done.is_mock && (
                <span className="notice-subscribe__mode">{t('notices.subscribe.prototypeMode')}</span>
              )}
              {done.sms_status === 'failed' && (
                <span className="notice-subscribe__failed"> {t('notices.subscribe.sendFailed')}</span>
              )}
            </p>
          )}
          {done.email_status && (
            <p className="notice-subscribe__channel-result">
              {t('notices.subscribe.email')} {done.email_status === 'sent' ? '✓' : '—'}{' '}
              {done.is_mock && (
                <span className="notice-subscribe__mode">{t('notices.subscribe.prototypeMode')}</span>
              )}
              {done.email_status === 'failed' && (
                <span className="notice-subscribe__failed"> {t('notices.subscribe.sendFailed')}</span>
              )}
            </p>
          )}
        </div>
      ) : (
        <form className="notice-subscribe__form" onSubmit={onSubscribe}>
          <label className="notice-subscribe__check">
            <input
              type="checkbox"
              checked={wantsSms}
              onChange={(event) => setWantsSms(event.target.checked)}
            />
            {t('notices.subscribe.sms')}
          </label>
          {wantsSms && (
            <Input
              label={t('notices.subscribe.mobileNumber')}
              type="tel"
              value={phoneNumber}
              placeholder="98765 43210"
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          )}

          <label className="notice-subscribe__check">
            <input
              type="checkbox"
              checked={wantsEmail}
              onChange={(event) => setWantsEmail(event.target.checked)}
            />
            {t('notices.subscribe.email')}
          </label>
          {wantsEmail && (
            <Input
              label={t('notices.subscribe.emailAddress')}
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          )}

          <label className="notice-subscribe__check notice-subscribe__check--consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            {t('notices.subscribe.consent')}
          </label>

          {subscribeMutation.error && (
            <p className="notice-subscribe__error" role="alert">
              {subscribeMutation.error.message}
            </p>
          )}

          <Button type="submit" variant="secondary" disabled={!canSubmit || subscribeMutation.pending}>
            {subscribeMutation.pending ? t('notices.subscribe.subscribing') : t('notices.subscribe.subscribeButton')}
          </Button>
        </form>
      )}
    </div>
  );
}

/* Landowner credentials are provisioned by BhoomiMitra, not chosen at a
   public signup form — see Signup.jsx's own note on why that option isn't
   there any more. This is the one place a landowner's account comes from:
   a verified land record, not a code someone handed them. */
function ProvisionSection({ identifier }) {
  const { t } = useI18n();
  const [credentials, setCredentials] = useState(null);
  const provisionMutation = useMutation((payload) => noticesApi.provision(payload));

  async function onProvision() {
    try {
      setCredentials(await provisionMutation.run(identifier));
    } catch {
      /* provisionMutation.error already carries the message to show —
         most commonly 409, "credentials already issued". */
    }
  }

  if (credentials) {
    return (
      <div className="notice-credentials">
        <h3 className="notice-credentials__title">{t('notices.provision.yourLoginTitle')}</h3>
        <dl className="notice-credentials__facts">
          <div>
            <dt>{t('notices.provision.username')}</dt>
            <dd className="notice-credentials__value">{credentials.username}</dd>
          </div>
          <div>
            <dt>{t('notices.provision.temporaryPassword')}</dt>
            <dd className="notice-credentials__value">{credentials.temporary_password}</dd>
          </div>
          <div>
            <dt>{t('notices.provision.verificationCode')}</dt>
            <dd className="notice-credentials__value">{credentials.login_code_hint}</dd>
          </div>
        </dl>
        <p className="notice-credentials__note">{t('notices.provision.writeDown')}</p>
        <Link to="/login">
          <Button type="button" variant="primary">{t('notices.provision.goToSignIn')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="notice-subscribe">
      <h3 className="notice-subscribe__title">{t('notices.provision.title')}</h3>
      <p className="notice-subscribe__lede">{t('notices.provision.lede')}</p>
      {provisionMutation.error && (
        <p className="notice-subscribe__error" role="alert">
          {provisionMutation.error.message}
        </p>
      )}
      <Button type="button" variant="secondary" onClick={onProvision} disabled={provisionMutation.pending}>
        {provisionMutation.pending ? t('notices.provision.creating') : t('notices.provision.getLogin')}
      </Button>
    </div>
  );
}

/* The public notice board.

   Publishing notifications publicly is a statutory requirement under the
   Act, not decoration. Nothing here is authenticated: a public notice is
   public.

   Each row is one published INSTRUMENT, read from the statutory notices
   register — not one case sitting at a stage. That distinction is the whole
   correctness of this page. A Section 11 notification is a completed public
   act with a date and a gazette number; it does not stop having happened
   because the file has since moved on to the award, and it has not happened
   merely because a case reached the declaration stage internally. One
   acquisition therefore appears twice once it has been both notified and
   declared, which is right — two instruments, two dates, and the sixty-day
   objection window runs from the first of them. */

const PUBLISHED_NOTICE_TYPES = ['preliminary_notification', 'declaration'];

export default function Notices() {
  const { t } = useI18n();
  const NOTICE_NOTE = {
    preliminary_notification: t('notices.noteNotification'),
    declaration: t('notices.noteDeclaration'),
  };
  const [noticeType, setNoticeType] = useState('');
  const [districtId, setDistrictId] = useState('');

  const notices = useApi(
    (opts) =>
      noticesApi.list(
        { notice_type: noticeType || undefined, limit: 100 },
        opts,
      ),
    [noticeType],
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
        <h1 className="public-page__title">{t('notices.pageTitle')}</h1>
        <div className="public-page__rule" aria-hidden="true" />

        <p className="public-page__lede">{t('notices.pageLede')}</p>

        <LookupCard />

        <div className="public-page__filters" style={{ marginTop: 'var(--s6)' }}>
          <Select
            label={t('notices.instrument')}
            value={noticeType}
            placeholder={t('notices.instrumentPlaceholder')}
            options={PUBLISHED_NOTICE_TYPES.map((value) => ({
              value,
              label: noticeTypeLabel(value),
            }))}
            onChange={(event) => setNoticeType(event.target.value)}
          />
          <Select
            label={t('notices.district')}
            value={districtId}
            placeholder={t('notices.allDistricts')}
            options={districtOptions}
            onChange={(event) => setDistrictId(event.target.value)}
          />
        </div>

        {notices.loading && <Loading label={t('notices.loading')} rows={6} />}
        {notices.error && <ErrorState error={notices.error} onRetry={notices.reload} />}

        {visible && visible.length === 0 && (
          <Empty
            title={t('notices.noNoticesTitle')}
            body={
              districtId || noticeType
                ? t('notices.noNoticesFiltered')
                : t('notices.noNoticesAtAll')
            }
          />
        )}

        {visible &&
          visible.map((notice) => (
            /* A case appears once per instrument, so the case number alone is
               not unique here — the register allows one of each type per
               case and no more. */
            <article key={`${notice.case_number}-${notice.notice_type}`} className="notice">
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
                <p className="notice__meta">{t('notices.requiringBody', notice.requiring_body)}</p>
                <p className="notice__meta">
                  {t('notices.parcelsAndArea', fmt.count(notice.parcel_count), fmt.hectares(notice.total_area_ha))}
                </p>
                {/* What makes this a citable record rather than an
                    announcement: the provision it issued under, the office
                    that issued it, and the gazette it appeared in. */}
                <p className="notice__cite">
                  {notice.section_reference} · {notice.issuing_authority}
                  {notice.gazette_number ? ` · ${t('notices.gazette', notice.gazette_number)}` : ''}
                </p>
                <p className="notice__meta" style={{ marginTop: 'var(--s2)' }}>
                  {NOTICE_NOTE[notice.notice_type]}
                </p>
              </div>

              <div className="notice__stage">
                <StatusBadge
                  kind="noticeType"
                  value={notice.notice_type}
                  title={noticeSection(notice.notice_type)}
                />
                {/* The one thing on this row that describes today rather than
                    the date of publication, so it is set apart from the
                    instrument above it rather than badged alongside — two
                    pills would read as two states of one thing. */}
                <p className="notice__since">
                  {t('notices.caseNowAt', stageLabel(notice.current_stage))}
                </p>
              </div>
            </article>
          ))}
      </main>

      <PublicFooter />
    </div>
  );
}
