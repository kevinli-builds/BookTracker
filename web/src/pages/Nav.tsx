import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clearToken, changePassword } from '../api/client';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/goals', label: 'Goals' },
  { to: '/invites', label: 'Invites' },
  { to: '/users', label: 'Participants' },
  { to: '/survey', label: 'Survey' },
  { to: '/data', label: 'Data' },
];

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) { setError('New passwords do not match'); return; }
    if (next.length < 8) { setError('New password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={{ margin: '0 0 16px' }}>Change Password</h3>
        {done ? (
          <>
            <p style={{ color: '#2ecc71' }}>Password updated successfully.</p>
            <button style={styles.btn} onClick={onClose}>Close</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Current password</label>
            <input style={styles.input} type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
            <label style={styles.label}>New password</label>
            <input style={styles.input} type="password" value={next} onChange={e => setNext(e.target.value)} required />
            <label style={styles.label}>Confirm new password</label>
            <input style={styles.input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            {error && <p style={{ color: '#e74c3c', margin: '8px 0 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button type="submit" style={styles.btn} disabled={saving}>{saving ? 'Saving…' : 'Update'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Nav({ onLogout }: { onLogout: () => void }) {
  const { pathname } = useLocation();
  const [showChangePw, setShowChangePw] = useState(false);

  return (
    <>
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
        <button style={styles.logoutBtn} onClick={() => setShowChangePw(true)}>
          Change password
        </button>
        <button
          style={styles.logoutBtn}
          onClick={() => { clearToken(); onLogout(); }}
        >
          Log out
        </button>
      </nav>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </>
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
    gap: 12,
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
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    width: 360,
    color: '#111',
  },
  label: { display: 'block', fontSize: 13, marginBottom: 4, marginTop: 12, color: '#555' },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #ddd',
    fontSize: 14,
    boxSizing: 'border-box',
  },
  btn: {
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 14,
  },
  cancelBtn: {
    background: 'transparent',
    color: '#555',
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 14,
  },
};
