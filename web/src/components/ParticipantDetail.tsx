import React, { useState } from 'react';
import { UserDetail, getUserDetail, updateUser } from '../api/client';

// Per-participant management modal: rename, withdraw/reactivate, and a read-only
// view of their logs, goals (with auto-checked progress), and feedback.
export default function ParticipantDetail({
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
  activeTag: { background: '#dcfce7', color: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  withdrawnTag: { background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  withdrawBtn: { background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  reactivateBtn: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 },
  stat: { background: '#1a1a2e', borderRadius: 10, padding: 12, textAlign: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 800 },
  statLabel: { color: '#aaa', fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: '18px 0 8px' },
  muted: { fontSize: 13, color: '#999' },
  mono: { fontFamily: 'monospace', fontSize: 12, fontWeight: 700 },
  innerTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  ith: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: 12, color: '#666' },
  itd: { padding: '6px 8px', borderBottom: '1px solid #f4f4f4' },
  metYes: { color: '#16a34a', fontWeight: 700 },
  feedbackRow: { borderBottom: '1px solid #f4f4f4', padding: '8px 0', fontSize: 13 },
};
