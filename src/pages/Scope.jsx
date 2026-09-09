import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import '../components/public/public.css';

/* What this build actually does, and what it deliberately doesn't yet —
   stated plainly rather than claimed, and surfaced where a reviewer will
   actually see it instead of only in the repo's SECURITY.md /
   DEPLOYMENT.md. Every line here names the real behaviour; nothing is
   aspirational. See those two files for the fuller version. */

const SCOPE_ITEMS = [
  {
    tone: 'warn',
    stamp: 'Simulated',
    title: 'Land-records integration (Telangana Dharani)',
    body: 'The adapter is real — one class per state, selected by a registry, no change to core logic to add another. Dharani itself is simulated today: it reads our own database and re-expresses it in Dharani’s real field vocabulary. A live call needs government API access a student team doesn’t have. The panel on every case discloses this live, not just here.',
  },
  {
    tone: 'warn',
    stamp: 'Manual',
    title: 'Compensation & fund-deposit tracking',
    body: 'Payment status and deposited amounts are officer-recorded fields, reflecting money that moved elsewhere. We deliberately never touch real fund movement — that belongs on PFMS or treasury rails, and a hackathon prototype holding custody of government compensation money would be the wrong kind of ambitious.',
  },
  {
    tone: 'warn',
    stamp: 'Not built',
    title: 'Aadhaar / UIDAI identity verification',
    body: 'Real Aadhaar authentication needs an AUA/KUA license this project doesn’t hold. A landowner can self-provision an account with only a survey number or ULPIN already on the public record — no OTP, no officer approval. That’s a real, deliberately accepted trust boundary for a prototype, not a discovered flaw.',
  },
  {
    tone: 'info',
    stamp: 'Partial',
    title: 'Notifications',
    body: 'SMS (Twilio) and email (SMTP) are live, pluggable channels — chosen over WhatsApp so a citizen never has to opt in to a sandbox or business template before this platform can reach them. There is no browser/mobile push. Sending SMS to an Indian number needs the sender registered under TRAI’s DLT framework, separate from this codebase.',
  },
  {
    tone: 'info',
    stamp: 'Partial',
    title: 'Multilingual coverage',
    body: 'English and Hindi cover the public-facing surface — landing, the notice board, login. The authenticated officer workspace is English-only, and the Hindi text is a strong first draft, not yet reviewed against a published glossary.',
  },
  {
    tone: 'idle',
    stamp: 'Prototype-stage',
    title: 'Hosting',
    body: 'Deployed on Render and Supabase for iteration speed this week. The application is a standard Dockerized FastAPI service against Postgres/PostGIS, with no platform-specific code — moving it to NIC MeghRaj or an empanelled Government Community Cloud provider is a redeploy, not a rewrite.',
  },
];

const SECURITY_ITEMS = [
  {
    title: 'Authentication',
    body: 'Passwords hashed with bcrypt, never stored or logged in the clear. A second factor is mandatory on every password login — not optional. Face recognition works as a full login method, matched entirely server-side. Every account is invitation-only; nobody self-registers into an officer role.',
  },
  {
    title: 'Access control',
    body: 'Role-based access is enforced at the database query layer, not just the route — nine roles, scoped by district and state, so a bug in one endpoint can’t leak another district’s cases through a different one.',
  },
  {
    title: 'Data protection',
    body: 'At-rest encryption (AES-128 with an authenticated HMAC) is applied where it matters most — TOTP secrets and biometric templates, the two kinds of data a person cannot rotate if a backup ever leaks. Every mutating action writes to an append-only audit log.',
  },
  {
    title: 'What we don’t claim',
    body: 'No formal CERT-In, GIGW, or ISO 27001 certification. That requires a real external audit this hackathon build hasn’t undergone — we’d rather say so than imply it.',
  },
];

export default function Scope() {
  return (
    <div className="public">
      <PublicHeader />
      <main className="public-page" id="main">
        <h1 className="public-page__title">Scope & Security</h1>
        <div className="public-page__rule" aria-hidden="true" />
        <p className="public-page__lede">
          What BhoomiMitra actually does, and where we drew the line deliberately rather than ran
          out of time quietly. Every claim below names the real behaviour — nothing here is
          aspirational, and where something is simulated or manual, the product tells you so on
          the same screen, not just on this page.
        </p>

        <h2 className="scope__section-title">Where we drew the line, and why</h2>
        <div className="scope__list">
          {SCOPE_ITEMS.map((item) => (
            <div className="scope__item" key={item.title}>
              <span className={`badge badge--${item.tone} scope__stamp`}>
                <span className="badge__dot" aria-hidden="true" />
                {item.stamp}
              </span>
              <div>
                <h3 className="scope__item-title">{item.title}</h3>
                <p className="scope__item-body">{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="scope__section-title" style={{ marginTop: 'var(--s8)' }}>
          Security posture
        </h2>
        <div className="scope__list">
          {SECURITY_ITEMS.map((item) => (
            <div className="scope__item scope__item--plain" key={item.title}>
              <div>
                <h3 className="scope__item-title">{item.title}</h3>
                <p className="scope__item-body">{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="scope__section-title" style={{ marginTop: 'var(--s8)' }}>Roadmap</h2>
        <p className="scope__item-body" style={{ maxWidth: '68ch' }}>
          In order of what we’d build next: an OTP or officer-approval step for landowner
          self-provisioning; a live land-records connection for one real state once access is
          granted; a formal security review against GoI standards; and support for a second
          statutory workflow with its own stage sequence, alongside RFCTLARR and the National
          Highways Act.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
