import React, { useEffect, useState } from 'react';
import {
  AdminUser,
  GoalTemplate,
  UserDetail,
  assignGoals,
  getAdminGoals,
  getAllLogs,
  getUserDetail,
  getUsers,
  updateUser,
} from '../api/client';
import { downloadCsv } from '../lib/csv';
import { ExportButton, PageHeader, tableStyles } from '../components/ui';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [deadline, setDeadline] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<UserDetail | null>(null);

  const loadUsers = () => getUsers().then(setUsers);

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

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(u =>
        (u.displayName ?? '').toLowerCase().includes(q) ||
        (u.inviteCode?.label ?? '').toLowerCase().includes(q) ||
        (u.inviteCode?.code ?? '').toLowerCase().includes(q))
    : users;

  const toggleAll = () => {
    const ids = filtered.map(u => u.id);
    const allSelected = ids.every(id => selected.has(id)) && ids.length > 0;
    setSelected(allSelected ? new Set() : new Set(ids));
  };

  const handleAssign = async () => {
    setAssigning(true);
    setResult(null);
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined;
      const res = await assignGoals(ids, deadline || undefined);
      setResult(`Assigned to ${res.assigned} participant(s).`);
      setSelected(new Set());
    } catch {
      setResult('Assignment failed — make sure at least one goal is in the random pool.');
    } finally {
      setAssigning(false);
    }
  };

  const exportUsers = () => {
    downloadCsv(
      `booktracker-participants-${new Date().toISOString().slice(0, 10)}.csv`,
      users.map(u => ({
        invite_code: u.inviteCode?.code ?? '',
        participant_label: u.inviteCode?.label ?? '',
        display_name: u.displayName ?? '',
        status: u.status,
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
        invite_code: l.user?.inviteCode?.code ?? '',
        participant_label: l.user?.inviteCode?.label ?? '',
        display_name: l.user?.displayName ?? '',
        user_id: l.userId,
        title: l.title,
        author: l.author,
        minutes_read: l.minutesRead,
        google_books_id: l.googleBooksId,
        logged_at: new Date(l.loggedAt).toISOString(),
      }))
    );
  };

  const poolCount = templates.filter(t => t.randomPool).length;

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <PageHeader title="Participants">
        <ExportButton onClick={exportUsers}>Export participants CSV</ExportButton>
        <ExportButton onClick={exportLogs}>Export reading logs CSV</ExportButton>
      </PageHeader>

      <input
        style={s.searchInput}
        placeholder="Search by name, participant ID, or code…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div style={s.toolBar}>
        <span style={s.meta}>{filtered.length} of {users.length} participants · {selected.size} selected</span>
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
            {assigning ? 'Assigning...' : selected.size > 0 ? `Assign to ${selected.size} selected` : 'Assign to all active'}
          </button>
        </div>
      </div>

      {result && <p style={s.result}>{result}</p>}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>
              <input type="checkbox" checked={filtered.length > 0 && filtered.every(u => selected.has(u.id))} onChange={toggleAll} />
            </th>
            <th style={s.th}>Code</th>
            <th style={s.th}>Participant</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Logs</th>
            <th style={s.th}>Goals</th>
            <th style={s.th}>Streak</th>
            <th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id} style={{ ...(selected.has(u.id) ? s.trSelected : s.tr), ...(u.status === 'withdrawn' ? s.trWithdrawn : {}) }}>
              <td style={s.td}>
                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} />
              </td>
              <td style={{ ...s.td, ...s.mono }}>{u.inviteCode?.code ?? '—'}</td>
              <td style={s.td}>
                {u.displayName ?? <em style={{ color: '#aaa' }}>unnamed</em>}
                {u.inviteCode?.label && u.inviteCode.label !== u.displayName && (
                  <span style={s.labelTag}>{u.inviteCode.label}</span>
                )}
              </td>
              <td style={s.td}>
                {u.status === 'withdrawn'
                  ? <span style={s.withdrawnTag}>withdrawn</span>
                  : <span style={s.activeTag}>active</span>}
              </td>
              <td style={s.td}>{u._count.logs}</td>
              <td style={s.td}>{u._count.userGoals}</td>
              <td style={s.td}>{u.streak ? `${u.streak.currentStreak}d` : '—'}</td>
              <td style={{ ...s.td, textAlign: 'right' }}>
                <button style={s.manageBtn} onClick={() => getUserDetail(u.id).then(setDetail)}>Manage</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <p style={{ color: '#999', marginTop: 24, textAlign: 'center' }}>
          {users.length === 0 ? 'No participants yet.' : 'No participants match your search.'}
        </p>
      )}

      {detail && (
        <ParticipantDetail
          detail={detail}
          onClose={() => setDetail(null)}
          onChanged={updated => { setDetail(updated); loadUsers(); }}
        />
      )}
    </div>
  );
}

function ParticipantDetail({
  detail,
  onClose,
  onChanged,
}: {
  detail: UserDetail;
  onClose: () => void;
  onChanged: (d: UserDetail) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(detail.displayName ?? '');
  const [busy, setBusy] = useState(false);

  const refresh = async () => onChanged(await getUserDetail(detail.id));

  const saveName = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateUser(detail.id, { displayName: nameDraft.trim() });
      setEditingName(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateUser(detail.id, { status: detail.status === 'active' ? 'withdrawn' : 'active' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div>
            {editingName ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={s.input} value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus />
                <button style={s.smallBtn} onClick={saveName} disabled={busy}>Save</button>
                <button style={s.smallGhostBtn} onClick={() => setEditingName(false)}>Cancel</button>
              </div>
            ) : (
              <h2 style={s.modalTitle}>
                {detail.displayName ?? <em style={{ color: '#aaa' }}>unnamed</em>}
                <button style={s.linkBtn} onClick={() => { setNameDraft(detail.displayName ?? ''); setEditingName(true); }}>Edit name</button>
              </h2>
            )}
            <div style={s.subMeta}>
              Code <span style={s.mono}>{detail.inviteCode?.code ?? '—'}</span>
              {detail.inviteCode?.label && <> · ID <strong>{detail.inviteCode.label}</strong></>}
              {' · '}Joined {new Date(detail.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.statusRow}>
          <span>Status: {detail.status === 'withdrawn' ? <span style={s.withdrawnTag}>withdrawn</span> : <span style={s.activeTag}>active</span>}</span>
          <button style={detail.status === 'active' ? s.withdrawBtn : s.reactivateBtn} onClick={toggleStatus} disabled={busy}>
            {detail.status === 'active' ? 'Mark withdrawn' : 'Reactivate'}
          </button>
        </div>

        <div style={s.statGrid}>
          <Stat label="Books logged" value={new Set(detail.logs.map(l => l.title)).size} />
          <Stat label="Minutes" value={detail.logs.reduce((s2, l) => s2 + l.minutesRead, 0)} />
          <Stat label="Current streak" value={`${detail.streak?.currentStreak ?? 0}d`} />
          <Stat label="Goals" value={detail.goals.length} />
        </div>

        <h3 style={s.sectionTitle}>Goals ({detail.goals.length})</h3>
        {detail.goals.length === 0 ? <p style={s.muted}>No goals assigned.</p> : (
          <table style={s.innerTable}>
            <thead><tr><th style={s.ith}>Goal</th><th style={s.ith}>Progress</th><th style={s.ith}>Met</th><th style={s.ith}>Status</th></tr></thead>
            <tbody>
              {detail.goals.map(g => (
                <tr key={g.userGoalId}>
                  <td style={s.itd}>{g.title}</td>
                  <td style={s.itd}>{g.progress}</td>
                  <td style={s.itd}>{!g.autoCheckable ? '—' : g.met ? <span style={s.metYes}>✓</span> : 'no'}</td>
                  <td style={s.itd}>{g.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 style={s.sectionTitle}>Recent reading ({detail.logs.length})</h3>
        {detail.logs.length === 0 ? <p style={s.muted}>No books logged yet.</p> : (
          <table style={s.innerTable}>
            <thead><tr><th style={s.ith}>Title</th><th style={s.ith}>Author</th><th style={s.ith}>Min</th><th style={s.ith}>Date</th></tr></thead>
            <tbody>
              {detail.logs.slice(0, 25).map(l => (
                <tr key={l.id}>
                  <td style={s.itd}>{l.title}</td>
                  <td style={s.itd}>{l.author}</td>
                  <td style={s.itd}>{l.minutesRead}</td>
                  <td style={s.itd}>{new Date(l.loggedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 style={s.sectionTitle}>Feedback ({detail.feedback.length})</h3>
        {detail.feedback.length === 0 ? <p style={s.muted}>No feedback submitted.</p> : (
          detail.feedback.map(f => (
            <div key={f.id} style={s.feedbackRow}>
              <div style={{ fontWeight: 600 }}>{f.goalTitle} {f.rating != null && <span style={{ color: '#f59e0b' }}>{'★'.repeat(f.rating)}</span>}</div>
              {f.text && <div style={s.muted}>{f.text}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={s.stat}>
      <div style={s.statValue}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  searchInput: { width: '100%', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px', fontSize: 14, marginBottom: 14 },
  toolBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 },
  toolRight: { display: 'flex', alignItems: 'center', gap: 10 },
  meta: { fontSize: 13, color: '#666' },
  dateInput: { border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', fontSize: 13 },
  primaryBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  result: { fontSize: 13, color: '#22c55e', marginBottom: 10 },
  table: tableStyles.table,
  th: tableStyles.th,
  tr: tableStyles.tr,
  trSelected: { ...tableStyles.tr, background: '#f0f4ff' },
  trWithdrawn: { opacity: 0.55 },
  td: tableStyles.td,
  mono: { fontFamily: 'monospace', fontSize: 12, fontWeight: 700 },
  labelTag: { background: '#eef2ff', color: '#3730a3', borderRadius: 5, padding: '1px 6px', fontSize: 11, marginLeft: 8 },
  activeTag: { background: '#dcfce7', color: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  withdrawnTag: { background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  manageBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  // Detail modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 },
  modal: { background: '#fff', borderRadius: 16, padding: 28, width: 640, maxHeight: '88vh', overflowY: 'auto' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 },
  subMeta: { fontSize: 12, color: '#666', marginTop: 6 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  input: { border: '1px solid #ddd', borderRadius: 8, padding: '7px 10px', fontSize: 14 },
  linkBtn: { background: 'none', border: 'none', color: '#3730a3', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  smallBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
  smallGhostBtn: { background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
  statusRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f8fb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 },
  withdrawBtn: { background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  reactivateBtn: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 },
  stat: { background: '#1a1a2e', borderRadius: 10, padding: 12, textAlign: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 800 },
  statLabel: { color: '#aaa', fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: '18px 0 8px' },
  muted: { fontSize: 13, color: '#999' },
  innerTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  ith: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: 12, color: '#666' },
  itd: { padding: '6px 8px', borderBottom: '1px solid #f4f4f4' },
  metYes: { color: '#16a34a', fontWeight: 700 },
  feedbackRow: { borderBottom: '1px solid #f4f4f4', padding: '8px 0', fontSize: 13 },
};
