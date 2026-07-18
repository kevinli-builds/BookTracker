import React, { useEffect, useState } from 'react';
import { AdminData, getAdminData } from '../api/client';
import { PageHeader, TableScroll, tableStyles } from '../components/ui';

export default function DashboardPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminData().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>Failed to load data.</p>;

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div style={s.statGrid}>
        <StatCard label="Total Users" value={data.totalUsers} />
        <StatCard label="Reading Logs" value={data.totalLogs} />
        <StatCard label="Goals Assigned" value={data.totalGoals} />
        <StatCard label="Goals Completed" value={data.completedGoals} />
        <StatCard label="Completion Rate" value={`${data.completionRate}%`} />
      </div>

      <h2 style={s.h2}>Top Books Across All Users</h2>
      <TableScroll>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Title</th>
            <th style={s.th}>Author</th>
            <th style={s.th}>Times Logged</th>
          </tr>
        </thead>
        <tbody>
          {data.topBooks.map((b, i) => (
            <tr key={i} style={s.tr}>
              <td style={s.td}>{b.title}</td>
              <td style={s.td}>{b.author}</td>
              <td style={s.td}>{b._count.googleBooksId}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>

      <h2 style={s.h2}>Goal Completion Rates</h2>
      <TableScroll>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Goal</th>
            <th style={s.th}>Assigned</th>
            <th style={s.th}>Completed</th>
            <th style={s.th}>Rate</th>
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
      </TableScroll>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={s.card}>
      <div style={s.cardVal}>{value}</div>
      <div style={s.cardLabel}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  h2: { fontSize: 18, fontWeight: 700, margin: '32px 0 12px' },
  statGrid: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 },
  card: {
    background: '#1a1a2e',
    color: '#fff',
    borderRadius: 12,
    padding: '16px 20px',
    minWidth: 140,
  },
  cardVal: { fontSize: 28, fontWeight: 800 },
  cardLabel: { fontSize: 12, color: '#aaa', marginTop: 4 },
  table: tableStyles.table,
  th: tableStyles.th,
  tr: tableStyles.tr,
  td: { ...tableStyles.td, fontSize: 14 },
  barWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  bar: { height: 10, background: '#1a1a2e', borderRadius: 5, minWidth: 2 },
  barLabel: { fontSize: 12, color: '#555' },
};
