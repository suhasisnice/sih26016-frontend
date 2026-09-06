import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import * as adminApi from '../api/admin';
import * as referenceApi from '../api/reference';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { useEnums } from '../hooks/useEnums';
import { roleLabel } from '../lib/labels';
import * as fmt from '../lib/format';
import { required, validate } from '../lib/validate';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Field';
import FilterBar from '../components/ui/FilterBar';
import DataTable from '../components/ui/DataTable';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import '../components/dashboard/dashboard.css';
import './admin.css';

/* Mirrors app.dependencies.DISTRICT_SCOPED_ROLES / STATE_SCOPED_ROLES —
   which extra field an invitation needs depends on which tier the role
   works at, the same distinction the backend rejects a missing scope on. */
const DISTRICT_SCOPED_ROLES = ['district_officer', 'slao', 'field_officer', 'rnr_officer'];
const STATE_SCOPED_ROLES = ['state_officer'];

/* Mirrors invites.EXPIRY_HOURS — every code lives exactly this long, not a
   value chosen per invitation. Shown so the policy is visible somewhere
   even though there is no longer a field for it to live in. */
const EXPIRY_HOURS = 48;

const EMPTY_VALUES = {
  role: '',
  district_id: '',
  state_id: '',
  organisation: '',
  label: '',
  max_uses: '1',
};

function inviteStatus(invite) {
  if (invite.is_revoked) return { label: 'Revoked', tone: 'danger' };
  // A real timestamp now, not a bare date, so a plain Date comparison is
  // exact rather than the UTC-midnight trap a date-only value would hit.
  if (new Date(invite.expires_at) <= new Date()) return { label: 'Expired', tone: 'idle' };
  if (invite.used_count >= invite.max_uses) return { label: 'Used up', tone: 'idle' };
  return { label: 'Active', tone: 'ok' };
}

/* There is no open signup — every non-seeded account starts from a code
   issued here. This is the one screen that turns that from a fact about the
   backend into something an administrator can actually do. */
export default function Admin() {
  const { roles } = useEnums();
  const states = useApi((opts) => referenceApi.states(opts), []);

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [issued, setIssued] = useState(null); // { code, invite } — just created
  const [copied, setCopied] = useState(false);

  // A second, independent modal for reopening a code issued earlier — the
  // create flow's `issued` is one-shot state for the form that just
  // submitted, this is "the person clicked a row in the table below".
  const [viewing, setViewing] = useState(null); // an invite row, or null
  const [viewCopied, setViewCopied] = useState(false);

  const districts = useApi(
    (opts) => referenceApi.districts(values.state_id ? Number(values.state_id) : undefined, opts),
    [values.state_id],
    { skip: !open },
  );

  const invites = useApi((opts) => adminApi.listInviteCodes(opts), []);
  const create = useMutation((payload) => adminApi.createInviteCode(payload));
  const revoke = useMutation((inviteId) => adminApi.revokeInviteCode(inviteId));

  function set(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
  }

  function openModal() {
    setValues(EMPTY_VALUES);
    setErrors({});
    setIssued(null);
    setCopied(false);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    create.reset();
  }

  async function onSubmit() {
    const rules = { role: [required('Role')], max_uses: [required('Number of uses')] };
    if (DISTRICT_SCOPED_ROLES.includes(values.role)) rules.district_id = [required('District')];
    if (STATE_SCOPED_ROLES.includes(values.role)) rules.state_id = [required('State')];
    if (values.role === 'requiring_body') rules.organisation = [required('Organisation')];

    const result = validate(values, rules);
    setErrors(result.errors);
    if (!result.isValid) return;

    try {
      const result_ = await create.run({
        role: values.role,
        district_id: values.district_id ? Number(values.district_id) : null,
        state_id: values.state_id ? Number(values.state_id) : null,
        organisation: values.organisation.trim() || null,
        label: values.label.trim() || null,
        max_uses: Number(values.max_uses),
      });
      setIssued(result_);
      invites.reload();
    } catch {
      /* useMutation holds it; the modal renders it below. */
    }
  }

  async function copy(text, onDone) {
    try {
      await navigator.clipboard.writeText(text);
      onDone(true);
    } catch {
      /* Clipboard access can be blocked; the code is still shown on screen
         to select and copy by hand. */
    }
  }

  async function onRevoke(invite) {
    try {
      await revoke.run(invite.id);
      invites.reload();
    } catch {
      /* revoke.error surfaces near the table below */
    }
  }

  function openViewer(invite) {
    setViewCopied(false);
    setViewing(invite);
  }

  const columns = [
    {
      key: 'selector',
      header: 'Code',
      width: '110px',
      render: (row) => (
        <button type="button" className="admin__selector" onClick={() => openViewer(row)}>
          {row.selector}…
        </button>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <div>
          <div>{roleLabel(row.role)}</div>
          {row.label && <div className="admin__note">{row.label}</div>}
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (row) => row.district_name || row.state_name || row.organisation || 'National',
    },
    {
      key: 'used_count',
      header: 'Uses',
      width: '90px',
      align: 'num',
      render: (row) => `${row.used_count} / ${row.max_uses}`,
    },
    {
      key: 'expires_at',
      header: 'Expires',
      width: '150px',
      render: (row) => fmt.dateTime(row.expires_at),
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row) => {
        const s = inviteStatus(row);
        return (
          <span className={`badge badge--${s.tone}`}>
            <span className="badge__dot" aria-hidden="true" />
            {s.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: '90px',
      render: (row) =>
        !row.is_revoked && (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => onRevoke(row)}
            disabled={revoke.pending}
          >
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="Every account on the platform, and how new ones get created. There is no open signup — an account either starts from an invitation issued here, or an officer provisions a landowner's login from a verified land record."
      />

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Invitations</h2>
          <Button variant="primary" onClick={openModal}>New invite code</Button>
        </div>

        {invites.loading && <Loading label="Loading invitations" rows={4} />}
        {invites.error && <ErrorState error={invites.error} onRetry={invites.reload} />}
        {revoke.error && <ErrorState error={revoke.error} title="That invitation could not be revoked" />}

        {invites.data && invites.data.items.length === 0 && (
          <Empty title="No invitations yet" body="Issue one to let someone register an account." />
        )}

        {invites.data && invites.data.items.length > 0 && (
          <DataTable
            columns={columns}
            rows={invites.data.items}
            getRowKey={(row) => row.id}
            caption={`${invites.data.total} invitations issued — click a code to view or copy it`}
          />
        )}
      </section>

      <UsersSection />

      <Modal
        open={open}
        onClose={closeModal}
        title={issued ? 'Invitation created' : 'New invite code'}
        subtitle={
          issued
            ? `Good for ${EXPIRY_HOURS} hours. You can come back and copy it again from the table until then.`
            : `The person who redeems this gets exactly the role and scope chosen here. It expires ${EXPIRY_HOURS} hours after you issue it.`
        }
        busy={create.pending}
        error={create.error}
        footer={
          issued ? (
            <Button variant="primary" onClick={closeModal}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="quiet" onClick={closeModal} disabled={create.pending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={onSubmit} disabled={create.pending}>
                {create.pending ? 'Issuing…' : 'Issue invitation'}
              </Button>
            </>
          )
        }
      >
        {issued ? (
          <div className="admin__reveal">
            <p className="admin__reveal-code">{issued.code}</p>
            <Button variant="secondary" onClick={() => copy(issued.code, setCopied)}>
              <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
              {copied ? 'Copied' : 'Copy code'}
            </Button>
            <p className="admin__reveal-hint">
              Issued for {roleLabel(issued.invite.role)}
              {issued.invite.district_name ? ` in ${issued.invite.district_name}` : ''}
              {issued.invite.state_name ? ` in ${issued.invite.state_name}` : ''}. Share it with
              the person signing up — they enter it on the invitation screen before choosing a
              username and password.
            </p>
          </div>
        ) : (
          <div className="admin__form">
            <Select
              label="Role"
              value={values.role}
              error={errors.role}
              placeholder="Choose the role this account will have"
              options={(roles || []).map((r) => ({ value: r, label: roleLabel(r) }))}
              onChange={(event) => set('role', event.target.value)}
            />

            {STATE_SCOPED_ROLES.includes(values.role) && (
              <Select
                label="State"
                value={values.state_id}
                error={errors.state_id}
                placeholder={states.loading ? 'Loading states…' : 'Choose the state'}
                options={(states.data || []).map((s) => ({ value: String(s.id), label: s.name }))}
                onChange={(event) => set('state_id', event.target.value)}
              />
            )}

            {DISTRICT_SCOPED_ROLES.includes(values.role) && (
              <Select
                label="District"
                value={values.district_id}
                error={errors.district_id}
                placeholder={districts.loading ? 'Loading districts…' : 'Choose the district'}
                options={(districts.data || []).map((d) => ({ value: String(d.id), label: d.name }))}
                onChange={(event) => set('district_id', event.target.value)}
              />
            )}

            {values.role === 'requiring_body' && (
              <Input
                label="Organisation"
                value={values.organisation}
                error={errors.organisation}
                placeholder="National Highways Authority of India"
                onChange={(event) => set('organisation', event.target.value)}
                hint="The body this account files proposals for."
              />
            )}

            <Input
              label="Label"
              value={values.label}
              onChange={(event) => set('label', event.target.value)}
              placeholder="Optional — e.g. a name to remember who this is for"
            />

            <Input
              label="Number of uses"
              type="number"
              min="1"
              max="50"
              value={values.max_uses}
              error={errors.max_uses}
              onChange={(event) => set('max_uses', event.target.value)}
              hint="How many times this one code can be redeemed."
            />
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Invite code"
        subtitle={viewing ? `${roleLabel(viewing.role)} — issued ${fmt.dateTime(viewing.created_at)}` : undefined}
        footer={
          <Button variant="primary" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {viewing && viewing.code && (
          <div className="admin__reveal">
            <p className="admin__reveal-code">{viewing.code}</p>
            <Button variant="secondary" onClick={() => copy(viewing.code, setViewCopied)}>
              <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
              {viewCopied ? 'Copied' : 'Copy code'}
            </Button>
          </div>
        )}
        {/* Revoked or expired is a real "it was cleared" — anything else
            with no code just predates this feature, and saying "expired"
            about a row the table itself still shows as Active would be a
            straightforwardly false claim. */}
        {viewing && !viewing.code && (
          <Empty
            center
            title="No longer available"
            body={
              viewing.is_revoked
                ? 'This invitation was revoked, so its code was cleared.'
                : new Date(viewing.expires_at) <= new Date()
                  ? 'This invitation has expired, so its code was cleared. Issue a new one instead.'
                  : 'No saved copy exists for this invitation.'
            }
          />
        )}
      </Modal>
    </>
  );
}

const EMPTY_FILTERS = { role: '', district_id: '', is_active: '', q: '' };

/* The directory of every account that already exists — deactivate one,
   reactivate one, or reset its password. Distinct from the invitations
   above, which are how a new account gets created; nothing here creates
   one. */
function UsersSection() {
  const { user: currentUser } = useAuth();
  const { roles } = useEnums();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.q === searchInput ? current : { ...current, q: searchInput }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const districts = useApi((opts) => referenceApi.districts(undefined, opts), []);
  const users = useApi(
    (opts) =>
      adminApi.listUsers(
        {
          role: filters.role || undefined,
          district_id: filters.district_id || undefined,
          is_active: filters.is_active === '' ? undefined : filters.is_active === 'true',
          q: filters.q || undefined,
        },
        opts,
      ),
    [filters.role, filters.district_id, filters.is_active, filters.q],
  );

  const deactivate = useMutation((id) => adminApi.deactivateUser(id));
  const reactivate = useMutation((id) => adminApi.reactivateUser(id));
  const resetPassword = useMutation((id) => adminApi.resetUserPassword(id));

  const [actionError, setActionError] = useState(null);
  const [revealed, setRevealed] = useState(null); // ResetPasswordResponse, or null
  const [revealCopied, setRevealCopied] = useState(false);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  const hasFilters = Boolean(filters.role || filters.district_id || filters.is_active || filters.q);

  async function onToggleActive(row) {
    setActionError(null);
    try {
      if (row.is_active) await deactivate.run(row.id);
      else await reactivate.run(row.id);
      users.reload();
    } catch (err) {
      setActionError(err);
    }
  }

  async function onResetPassword(row) {
    setActionError(null);
    try {
      const result = await resetPassword.run(row.id);
      setRevealCopied(false);
      setRevealed(result);
    } catch (err) {
      setActionError(err);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setRevealCopied(true);
    } catch {
      /* Clipboard access can be blocked; the password is still shown on
         screen to select and copy by hand. */
    }
  }

  const columns = [
    {
      key: 'full_name',
      header: 'Account',
      render: (row) => (
        <span>
          <span className="person-name__title">{row.full_name}</span>
          <br />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{row.username}</span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', width: '200px', render: (row) => roleLabel(row.role) },
    {
      key: 'scope',
      header: 'Scope',
      width: '160px',
      render: (row) => row.district_name || row.state_name || row.organisation || 'National',
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '150px',
      render: (row) => (
        <span className={`badge badge--${row.is_active ? 'ok' : 'idle'}`}>
          <span className="badge__dot" aria-hidden="true" />
          {row.is_active ? 'Active' : 'Deactivated'}
          {row.must_change_password && row.is_active ? ' · must set password' : ''}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '220px',
      render: (row) => (
        <span style={{ display: 'flex', gap: 'var(--s3)' }}>
          <Button
            variant="link"
            onClick={() => onToggleActive(row)}
            disabled={
              (row.is_active ? deactivate.pending : reactivate.pending) || row.id === currentUser?.id
            }
          >
            {row.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
          <Button variant="link" onClick={() => onResetPassword(row)} disabled={resetPassword.pending}>
            Reset password
          </Button>
        </span>
      ),
    },
  ];

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Accounts</h2>
        <span className="section__count">{users.data ? `${users.data.total} accounts` : ''}</span>
      </div>

      <FilterBar>
        <FilterBar.Search
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by name or username"
        />
        <FilterBar.Select
          label="Role"
          value={filters.role}
          placeholder="Every role"
          options={(roles || []).map((r) => ({ value: r, label: roleLabel(r) }))}
          onChange={(event) => updateFilter('role', event.target.value)}
        />
        <FilterBar.Select
          label="District"
          value={filters.district_id}
          placeholder="Every district"
          options={(districts.data || []).map((d) => ({ value: String(d.id), label: d.name }))}
          onChange={(event) => updateFilter('district_id', event.target.value)}
        />
        <FilterBar.Select
          label="Status"
          value={filters.is_active}
          placeholder="Active and deactivated"
          options={[
            { value: 'true', label: 'Active only' },
            { value: 'false', label: 'Deactivated only' },
          ]}
          onChange={(event) => updateFilter('is_active', event.target.value)}
        />
        <FilterBar.Actions
          hasFilters={hasFilters}
          onClear={() => {
            setFilters(EMPTY_FILTERS);
            setSearchInput('');
          }}
        />
      </FilterBar>

      {users.loading && <Loading label="Loading accounts" rows={5} />}
      {users.error && <ErrorState error={users.error} onRetry={users.reload} />}
      {actionError && (
        <ErrorState error={actionError} title="That could not be done" onRetry={() => setActionError(null)} />
      )}

      {users.data && users.data.items.length === 0 && (
        <Empty title="No accounts match" body="Try clearing a filter." />
      )}

      {users.data && users.data.items.length > 0 && (
        <DataTable
          columns={columns}
          rows={users.data.items}
          getRowKey={(row) => row.id}
          isRowFlagged={(row) => !row.is_active}
          caption="Deactivating an account blocks sign-in without touching anything it already did. Resetting a password shows the new one exactly once."
        />
      )}

      <Modal
        open={Boolean(revealed)}
        onClose={() => setRevealed(null)}
        title="Password reset"
        subtitle={revealed ? `For ${revealed.username}. Share it with them now — it cannot be shown again.` : undefined}
        footer={
          <Button variant="primary" onClick={() => setRevealed(null)}>
            Done
          </Button>
        }
      >
        {revealed && (
          <div className="admin__reveal">
            <p className="admin__reveal-code">{revealed.temporary_password}</p>
            <Button variant="secondary" onClick={() => copy(revealed.temporary_password)}>
              <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
              {revealCopied ? 'Copied' : 'Copy password'}
            </Button>
            <p className="admin__reveal-hint">
              They must sign in with this and will be asked to set a new password immediately.
            </p>
          </div>
        )}
      </Modal>
    </section>
  );
}
