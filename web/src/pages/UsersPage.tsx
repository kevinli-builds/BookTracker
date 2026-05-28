import React, { useEffect, useState } from 'react';
import { AdminUser, GoalTemplate, assignGoals, getAdminGoals, getAllLogs, getUsers } from '../api/client';
import { downloadCsv } from '../lib/csv';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    Promise.all([getUsers(), getAdminGoals()])
      .then(([u, t]) => { setUsers(u); setTemplates(t); })
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === users.length ? new Set() : new Set(users.map(u => u.id)));
  };

  const handleAssign = async () => {
    setAssigning(true);
    setResult(null);
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined;
      const res = await assignGoals(ids, deadline || undefined);
      setResult(`Assigned to ${res.assigned} user(s).`);
      setSelected(new Set());
    } catch {
      setResult('Assignment failed — make sure at least one goal is in the random pool.');
    } finally {
      setAssigning(false);
    }
  };

  const poolCount = templates.filter(t => t.randomPool).length;

  const exportUsers = () => {
    downloadCsv(
      `booktracker-users-${new Date().toISOString().slice(0, 10)}.csv`,
      users.map(u => ({
        participant: u.displayName ?? '',
        user_id: u.id,
        joined: new Date(u.createdAt).toISOString(),
        reading_logs: u._count.logs,
        goals: u._count.userGoals,
        current_streak: u.streak?.currentStreak ?? 0,
        longest_streak: u.streak?.longestStreak ?? 0,
      }))
    );
  };

  const exportLogs = async () => {
    const logs = await getAllLogs();
    downloadCsv(
      `booktracker-reading-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      logs.map(l => ({
        participant: l.user?.displayName ?? '',
        user_id: l.userId,
        title: l.title,
        author: l.author,
        minutes_read: l.minutesRead,
        google_books_id: l.googleBooksId,
        logged_at: new Date(l.loggedAt).toISOString(),
      }))
    );
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Users</h1>
        <div style={s.exportGroup}>
          <button style={s.exportBtn} onClick={exportUsers}>Export users CSV</button>
          <button style={s.exportBtn} onClick={exportLogs}>Export reading logs CSV</button>
        </div>
      </div>

      <div style={s.toolBar}>
        <span style={s.meta}>{users.length} users · {selected.size} selected</span>
        <div style={s.toolRight}>
          <span style={s.meta}>{poolCount} goal{poolCount !== 1 ? 's' : ''} in pool</span>
          <input
            style={s.dateInput}
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            title="Assignment deadline (optional)"
          />
          <button style={s.primaryBtn} onClick={handleAssign} disabled={assigning || poolCount === 0}>
            {assigning ? 'Assigning...' : selected.size > 0 ? `Assign to ${selected.size} selected` : 'Assign to all'}
          </button>
        </div>
      </div>

      {result && <p style={s.result}>{result}</p>}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>
              <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleAll} />
            </th>
            <th style={s.th}>ID</th>
            <th style={s.th}>Display Name</th>
            <th style={s.th}>Joined</th>
            <th style={s.th}>Logs</th>
            <th style={s.th}>Goals</th>
            <th style={s.th}>Streak</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ ...s.tr, ...(selected.has(u.id) ? s.trSelected : {}) }}>
              <td style={s.td}>
                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} />
              </td>
              <td style={{ ...s.td, ...s.mono }}>{u.id.slice(0, 12)}…</td>
              <td style={s.td}>{u.displayName ?? <em style={{ color: '#aaa' }}>anonymous</em>}</td>
              <td style={s.td}>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td style={s.td}>{u._count.logs}</td>
              <td style={s.td}>{u._count.userGoals}</td>
              <td style={s.td}>{u.streak ? `${u.streak.currentStreak}d` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p style={{ color: '#999', marginTop: 24, textAlign: 'center' }}>No users yet.</p>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  exportGroup: { display: 'flex', gap: 8 },
  exportBtn: { background: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  toolBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 },
  toolRight: { display: 'flex', alignItems: 'center', gap: 10 },
  meta: { fontSize: 13, color: '#666' },
  dateInput: { border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', fontSize: 13 },
  primaryBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  result: { fontSize: 13, color: '#22c55e', marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { background: '#f0f0f7', padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700 },
  tr: { borderTop: '1px solid #eee' },
  trSelected: { background: '#f0f4ff' },
  td: { padding: '10px 16px', fontSize: 13 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
};
