import React, { useEffect, useState } from 'react';
import { AdminData, getAdminData } from '../api/client';

export default function DataPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'feedback' | 'goals'>('feedback');

  useEffect(() => {
    getAdminData().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>Failed to load data.</p>;

  return (
    <div>
      <h1 style={s.h1}>Research Data</h1>

      <div style={s.tabs}>
        {(['feedback', 'goals'] as const).map(t => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'feedback' ? 'User Feedback' : 'Goal Outcomes'}
          </button>
        ))}
      </div>

      {tab === 'feedback' && (
        <div>
          <p style={s.count}>{data.recentFeedback.length} feedback entries (most recent 50)</p>
          {data.recentFeedback.length === 0 ? (
            <p style={s.empty}>No feedback submitted yet.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Goal</th>
                  <th style={s.th}>Rating</th>
                  <th style={s.th}>Comment</th>
                  <th style={s.th}>User</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFeedback.map(f => (
                  <tr key={f.id} style={s.tr}>
                    <td style={s.td}>{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td style={s.td}>{f.userGoal.template.title}</td>
                    <td style={s.td}>
                      {f.rating != null ? (
                        <Stars rating={f.rating} />
                      ) : '—'}
                    </td>
                    <td style={{ ...s.td, maxWidth: 300 }}>{f.text ?? <em style={{ color: '#aaa' }}>no comment</em>}</td>
                    <td style={{ ...s.td, ...s.mono }}>{f.userId.slice(0, 10)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'goals' && (
        <div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Goal</th>
                <th style={s.th}>Assigned</th>
                <th style={s.th}>Completed</th>
                <th style={s.th}>Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.goalCompletionRates.map(g => (
                <tr key={g.id} style={s.tr}>
                  <td style={s.td}>{g.title}</td>
                  <td style={s.td}>{g.total}</td>
                  <td style={s.td}>{g.completed}</td>
                  <td style={s.td}>
                    <div style={s.barWrap}>
                      <div style={{ ...s.bar, width: `${g.rate}%` }} />
                      <span style={s.barLabel}>{g.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.goalCompletionRates.length === 0 && (
            <p style={s.empty}>No goal data yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: 16 }}>
      {'★'.repeat(Math.max(0, Math.min(5, rating)))}
      {'☆'.repeat(Math.max(0, 5 - Math.min(5, rating)))}
    </span>
  );
}

const s: Record<string, React.CSSProperties> = {
  h1: { fontSize: 24, fontWeight: 800, marginBottom: 16 },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #eee' },
  tab: {
    background: 'none',
    border: 'none',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: '#888',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
  },
  tabActive: { color: '#1a1a2e', borderBottomColor: '#1a1a2e' },
  count: { fontSize: 13, color: '#666', marginBottom: 12 },
  empty: { color: '#999', textAlign: 'center', marginTop: 32 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { background: '#f0f0f7', padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700 },
  tr: { borderTop: '1px solid #eee' },
  td: { padding: '10px 16px', fontSize: 13, verticalAlign: 'top' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  barWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  bar: { height: 10, background: '#1a1a2e', borderRadius: 5, minWidth: 2 },
  barLabel: { fontSize: 12, color: '#555' },
};
