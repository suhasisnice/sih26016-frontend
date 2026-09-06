import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ClipboardCheck,
  Compass,
  FileBarChart2,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MessageSquareWarning,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { OFFICERS, PROPOSAL_VIEWERS, REPORT_READERS, ROLES, SUPERVISORY } from '../../auth/permissions';
import { roleLabel } from '../../lib/labels';

/* Sidebar, top bar, current user and role, logout. Every authenticated page
   renders inside this. Which links appear is decided by the same role lists
   App.jsx uses to guard the routes themselves, so the sidebar never offers a
   page a role will then be bounced from. */
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: SUPERVISORY },
  { to: '/field-work', label: 'Field Work', icon: ClipboardCheck, roles: OFFICERS },
  { to: '/survey-tasks', label: 'My Surveys', icon: Compass, roles: OFFICERS },
  { to: '/projects', label: 'Projects', icon: Building2, roles: SUPERVISORY },
  { to: '/cases', label: 'Cases', icon: FolderKanban, roles: null },
  { to: '/proposals', label: 'Proposals', icon: FileBarChart2, roles: PROPOSAL_VIEWERS },
  { to: '/objections', label: 'Objections', icon: MessageSquareWarning, roles: null },
  { to: '/map', label: 'Map', icon: MapIcon, roles: SUPERVISORY },
  { to: '/reports', label: 'Reports', icon: FileBarChart2, roles: REPORT_READERS },
  { to: '/admin', label: 'Admin', icon: KeyRound, roles: [ROLES.ADMIN] },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const visible = NAV.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  function onLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar">
        <Link to="/dashboard" className="sidebar__brand">
          <img src="/brand/logo.png" alt="" className="sidebar__brand-mark" aria-hidden="true" />
          <span className="sidebar__brand-word">BHOOMIMITRA</span>
        </Link>

        <nav className="sidebar__nav" aria-label="Primary">
          {visible.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar__link${active ? ' is-active' : ''}`}
              >
                <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <span className="topbar__spacer" />
          <Link
            to="/security"
            className={`topbar__icon${location.pathname === '/security' ? ' is-active' : ''}`}
            aria-label="Security settings"
          >
            <ShieldCheck size={18} strokeWidth={1.75} />
          </Link>
          <Link
            to="/notifications"
            className={`topbar__icon${location.pathname === '/notifications' ? ' is-active' : ''}`}
            aria-label="Notifications"
          >
            <Bell size={18} strokeWidth={1.75} />
          </Link>
          <span className="topbar__user">
            <span className="topbar__user-name">{user ? user.full_name : ''}</span>
            <span className="topbar__user-role">{user ? roleLabel(user.role) : ''}</span>
          </span>
          <button type="button" className="topbar__logout" onClick={onLogout} aria-label="Sign out">
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </header>

        <p className="shell__disclaimer">
          Some operational records shown in this prototype are synthetic and are provided
          solely for demonstration. Official/public reference data is identified separately.
        </p>

        <main className="page" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
