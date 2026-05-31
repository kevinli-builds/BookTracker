import React, { useEffect, useState } from 'react';
import { AdminData, GoalProgress, getAdminData, getGoalProgress } from '../api/client';
import { downloadCsv } from '../lib/csv';
import { ExportButton, PageHeader, tableStyles } from '../components/ui';

export default function DataPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [progress, setProgress] = useState<GoalProgress[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'feedback' | 'goals' | 'progress'>('progress');

  useEffect(() => {
    Promise.all([
      getAdminData().then(setData),
      getGoalProgress().then(setProgress).catch(() => setProgress([])),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>Failed to load data.</p>;

  const today = new Date().toISOString().slice(0, 10);

  const exportFeedback = () => {
    downloadCsv(
      `booktracker-feedback-${today}.csv`,
      data.recentFeedback.map(f => ({
        invite_code: f.user?.inviteCode?.code ?? '',
        participant_label: f.user?.inviteCode?.label ?? '',
        display_name: f.user?.displayName ?? '',
        study_group: f.user?.studyGroup ?? '',
        user_id: f.userId,
        date: new Date(f.createdAt).toISOString(),
        goal: f.userGoal.template.title,
        rating: f.rating ?? '',
        comment: f.text ?? '',
      }))
    );
  };

  const exportGoals = () => {
    downloadCsv(
      `booktracker-goal-outcomes-${today}.csv`,
      data.goalCompletionRates.map(g => ({
        goal: g.title,
        assigned: g.total,
        completed: g.completed,
        completion_rate_pct: g.rate,
      }))
    );
  };

  const exportProgress = () => {
    downloadCsv(
      `booktracker-goal-progress-${today}.csv`,
      (progress ?? []).map(p => ({
        invite_code: p.inviteCode ?? '',
        participant_label: p.participantLabel ?? '',
        display_name: p.participant ?? '',
        study_group: p.studyGroup ?? '',
        user_id: p.userId,
        goal: p.goalTitle,
        type: p.type,
        progress: p.progress,
        criteria_met: p.autoCheckable ? (p.met ? 'yes' : 'no') : 'n/a',
        marked_status: p.status,
        assigned_at: new Date(p.assignedAt).toISOString(),
      }))
    );
  };

  const readyToComplete = (progress ?? []).filter(p => p.status === 'active' && p.met).length;

  return (
    <div>
      <PageHeader title="Research Data" />

      <div style={s.tabs}>
        {(['progress', 'feedback', 'goals'] as const).map(t => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'feedback' ? 'User Feedback' : t === 'goals' ? 'Goal Outcomes' : 'Goal Progress'}
            {t === 'progress' && readyToComplete > 0 && (
              <span style={s.tabBadge}>{readyToComplete}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'progress' && (
        <div>
          <div style={s.tabHeader}>
            <p style={s.count}>
              Auto-checked against reading logged since each goal was assigned.
              {readyToComplete > 0 && ` ${readyToComplete} met but not yet marked complete.`}
            </p>
            <ExportButton onClick={exportProgress} disabled={!progress || progress.length === 0}>Export CSV</ExportButton>
          </div>
          {!progress || progress.length === 0 ? (
            <p style={s.empty}>No active or completed goals yet.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Participant</th>
                  <th style={s.th}>Goal</th>
                  <th style={s.th}>Progress</th>
                  <th style={s.th}>Criteria met?</th>
                  <th style={s.th}>Marked</th>
                </tr>
              </thead>
              <tbody>
                {progress.map(p => (
                  <tr key={p.userGoalId} style={p.status === 'active' && p.met ? s.trHighlight : s.tr}>
                    <td style={s.td}>{p.participant ?? <em style={{ color: '#aaa' }}>unnamed</em>}</td>
                    <td style={s.td}>{p.goalTitle}</td>
                    <td style={s.td}>{p.progress}</td>
                    <td style={s.td}>
                      {!p.autoCheckable
                        ? <span style={{ color: '#aaa' }}>n/a</span>
                        : p.met
                          ? <span style={s.metYes}>✓ Met</span>
                          : <span style={s.metNo}>Not yet</span>}
                    </td>
                    <td style={s.td}>
                      {p.status === 'completed'
                        ? <span style={s.completedTag}>completed</span>
                        : p.met
                          ? <span style={s.readyTag}>ready to complete</span>
                          : <span style={{ color: '#888' }}>active</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'feedback' && (
        <div>
          <div style={s.tabHeader}>
            <p style={s.count}>{data.recentFeedback.length} feedback entries (most recent 50)</p>
            <ExportButton onClick={exportFeedback}>Export CSV</ExportButton>
          </div>
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
                  <th style={s.th}>Participant</th>
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
                    <td style={s.td}>
                      {f.user?.displayName ?? <em style={{ color: '#aaa' }}>unnamed</em>}
                      {f.user?.inviteCode?.code && <span style={s.codeTag}>{f.user.inviteCode.code}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'goals' && (
        <div>
          <div style={s.tabHeader}>
            <p style={s.count}>{data.goalCompletionRates.length} goals</p>
            <ExportButton onClick={exportGoals}>Export CSV</ExportButton>
          </div>
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
  tabBadge: { background: '#22c55e', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700, marginLeft: 6 },
  tabHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  count: { fontSize: 13, color: '#666', margin: 0 },
  empty: { color: '#999', textAlign: 'center', marginTop: 32 },
  table: tableStyles.table,
  th: tableStyles.th,
  tr: tableStyles.tr,
  trHighlight: { ...tableStyles.tr, background: '#f0fdf4' },
  metYes: { color: '#16a34a', fontWeight: 700 },
  metNo: { color: '#888' },
  completedTag: { background: '#e0e7ff', color: '#3730a3', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  readyTag: { background: '#dcfce7', color: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  td: { ...tableStyles.td, verticalAlign: 'top' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  codeTag: { fontFamily: 'monospace', fontSize: 11, background: '#f0f0f7', borderRadius: 4, padding: '1px 5px', marginLeft: 6 },
  barWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  bar: { height: 10, background: '#1a1a2e', borderRadius: 5, minWidth: 2 },
  barLabel: { fontSize: 12, color: '#555' },
};
