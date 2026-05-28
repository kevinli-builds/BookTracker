import React, { FormEvent, useState } from 'react';
import { login } from '../api/client';

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onLogin();
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={submit}>
        <h1 style={styles.title}>BookTracker</h1>
        <p style={styles.sub}>Provisioner login</p>
        {error && <p style={styles.error}>{error}</p>}
        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
        />
        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button style={styles.btn} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f0f7',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: 40,
    width: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  title: { fontSize: 26, fontWeight: 800, color: '#1a1a2e', marginBottom: 2 },
  sub: { fontSize: 14, color: '#888', marginBottom: 12 },
  error: { color: '#ef4444', fontSize: 13, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 },
  label: { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 4 },
  input: {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
  },
  btn: {
    marginTop: 12,
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 0',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
