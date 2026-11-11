import { Activity, BarChart3, ClipboardList, FileClock, LayoutDashboard, Settings2, ShieldCheck } from 'lucide-react';

const items = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'runs', label: 'Run history', icon: FileClock },
  { id: 'reports', label: 'Reports & settings', icon: ClipboardList },
];

export default function Sidebar({ active, onNavigate, user }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark"><Activity size={20} strokeWidth={2.5} /></div>
        <div><strong>DMS<span>Ops</span></strong><small>REPORT AUTOMATION</small></div>
      </div>
      <div className="workspace-switcher">
        <div className="workspace-icon">KD</div>
        <div className="workspace-copy"><span>Dealership workspace</span><strong>Kerala Demo Motors</strong></div>
        <span className="workspace-dot" />
      </div>
      <div className="side-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={18} /> <span>{label}</span>
            {id === 'runs' && <span className="nav-live-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="security-note"><div><ShieldCheck size={17} /></div><p><strong>Secure environment</strong><span>Mock DMS · Synthetic data only</span></p></div>
      <div className="sidebar-user"><div className="avatar avatar-small">{(user?.name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div><div className="sidebar-user-copy"><strong>{user?.name || 'Dashboard user'}</strong><span>{user?.role === 'admin' ? 'IT Administrator' : 'Dealership Manager'}</span></div><Settings2 size={16} className="sidebar-user-icon" /></div>
      <div className="side-footer">DMS AUTOMATION <span>•</span> v1.0.0</div>
    </aside>
  );
}
