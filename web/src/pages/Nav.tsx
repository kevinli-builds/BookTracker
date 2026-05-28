import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clearToken } from '../api/client';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/goals', label: 'Goals' },
  { to: '/users', label: 'Users' },
  { to: '/data', label: 'Data' },
];

export default function Nav({ onLogout }: { onLogout: () => void }) {
  const { pathname } = useLocation();

  return (
    <nav style={styles.nav}>
      <span style={styles.brand}>BookTracker Admin</span>
      <div style={styles.links}>
        {LINKS.map(l => (
          <Link
            key={l.to}
            to={l.to}
            style={{ ...styles.link, ...(pathname === l.to ? styles.active : {}) }}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <button
        style={styles.logoutBtn}
        onClick={() => { clearToken(); onLogout(); }}
      >
        Log out
      </button>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    background: '#1a1a2e',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    height: 56,
    gap: 24,
  },
  brand: { fontWeight: 700, fontSize: 16, marginRight: 8 },
  links: { display: 'flex', gap: 4, flex: 1 },
  link: {
    color: '#ccc',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 14,
  },
  active: { background: 'rgba(255,255,255,0.15)', color: '#fff' },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#ccc',
    borderRadius: 6,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 13,
  },
};
