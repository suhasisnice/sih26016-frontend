import { Link, useLocation } from 'react-router-dom';
import { Bell, Compass, FolderKanban, Home, Map as MapIcon, ShieldCheck } from 'lucide-react';
import { OFFICERS, SUPERVISORY } from '../../auth/permissions';

/* Bottom tab bar for narrow viewports — hidden at >=768px by CSS
   (see base.css), where the sidebar takes over. Deliberately not the same
   list as the sidebar's full NAV: CLAUDE.md's mobile requirement is a
   small, obvious primary path, not the whole nav shrunk down. Every
   officer role is also SUPERVISORY (OFFICERS is a subset — see
   auth/permissions.js), so an officer always gets the full five; a
   landowner or requiring body, who own no fieldwork or map, get three. */
function tabsFor(user) {
  if (!user) return [];
  const isOfficer = OFFICERS.includes(user.role);
  const isSupervisory = SUPERVISORY.includes(user.role);
  const tabs = [];

  if (isOfficer) {
    tabs.push({ to: '/field-work', label: 'Home', icon: Home });
    tabs.push({ to: '/survey-tasks', label: 'Tasks', icon: Compass });
  } else if (isSupervisory) {
    tabs.push({ to: '/dashboard', label: 'Home', icon: Home });
    tabs.push({ to: '/cases', label: 'Cases', icon: FolderKanban });
  } else {
    tabs.push({ to: '/cases', label: 'Home', icon: Home });
  }
  if (isSupervisory) {
    tabs.push({ to: '/map', label: 'Map', icon: MapIcon });
  }
  tabs.push({ to: '/notifications', label: 'Alerts', icon: Bell });
  tabs.push({ to: '/security', label: 'Me', icon: ShieldCheck });
  return tabs;
}

export default function MobileTabBar({ user }) {
  const location = useLocation();
  const tabs = tabsFor(user);
  if (tabs.length === 0) return null;

  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      {tabs.map((tab) => {
        const active = location.pathname.startsWith(tab.to);
        const Icon = tab.icon;
        return (
          <Link key={tab.to} to={tab.to} className={`mobile-tabbar__tab${active ? ' is-active' : ''}`}>
            <Icon size={20} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
