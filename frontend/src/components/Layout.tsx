import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoUrl from '../fond routier.jpg';

const navItems = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/documents/new', label: 'Nouveau document' },
  { to: '/documents/qr', label: 'QR codes' },
  { to: '/verify', label: 'Vérification' },
  { to: '/history', label: 'Historique' }
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoUrl} alt="Fonds Routier" className="brand-logo" />
          <h2>FDR Auth</h2>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <strong>{user?.full_name ?? 'Utilisateur'}</strong>
          <small>{user?.role ?? 'agent'}</small>
          <button onClick={logout} className="secondary-btn">Déconnexion</button>
        </div>
      </aside>

      <main className="main-panel">
        {children}
      </main>
    </div>
  );
}

export function Layout() {
  return (
    <LayoutShell>
      <Outlet />
    </LayoutShell>
  );
}
