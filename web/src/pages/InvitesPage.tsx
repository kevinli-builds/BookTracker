import React, { useEffect, useState } from 'react';
import { InviteCode, createInvites, deleteInvite, getInvites } from '../api/client';
import { downloadCsv } from '../lib/csv';

type Mode = 'count' | 'labels';

export default function InvitesPage() {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('labels');
  const [count, setCount] = useState(10);
  const [labelsText, setLabelsText] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    getInvites().then(setInvites).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      if (mode === 'labels') {
        const labels = labelsText.split('\n').map(l => l.trim()).filter(Boolean);
        if (labels.length === 0) { alert('Enter at least one participant label, one per line.'); return; }
        await createInvites({ labels });
        setLabelsText('');
      } else {
        await createInvites({ count });
      }
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this unused code?')) return;
    await deleteInvite(id);
    setInvites(prev => prev.filter(i => i.id !== id));
  };

  const copy = (code: string) => navigator.clipboard?.writeText(code);

  const exportCsv = () => {
    downloadCsv(
      `booktracker-invite-codes-${new Date().toISOString().slice(0, 10)}.csv`,
      invites.map(i => ({
        code: i.code,
        label: i.label ?? '',
        status: i.usedByUserId ? 'used' : 'unused',
        redeemed_by: i.usedBy?.displayName ?? '',
        redeemed_at: i.usedAt ? new Date(i.usedAt).toISOString() : '',
        created_at: new Date(i.createdAt).toISOString(),
      }))
    );
  };

  const usedCount = invites.filter(i => i.usedByUserId).length;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Invite Codes</h1>
        <button style={s.exportBtn} onClick={exportCsv} disabled={invites.length === 0}>Export codes CSV</button>
      </div>

      <div style={s.card}>
        <div style={s.modeRow}>
          <label style={s.radio}>
            <input type="radio" checked={mode === 'labels'} onChange={() => setMode('labels')} />
            One per participant (labeled)
          </label>
          <label style={s.radio}>
            <input type="radio" checked={mode === 'count'} onChange={() => setMode('count')} />
            A batch of blank codes
          </label>
        </div>

        {mode === 'labels' ? (
          <>
            <p style={s.hint}>Enter one participant label per line (e.g. P001, P002). Each gets its own single-use code, and that label becomes the participant's name in the app.</p>
            <textarea
              style={s.textarea}
              rows={5}
              placeholder={'P001\nP002\nP003'}
              value={labelsText}
              onChange={e => setLabelsText(e.target.value)}
            />
          </>
        ) : (
          <>
            <p style={s.hint}>Generate this many unlabeled single-use codes. Participants will type their own name after redeeming.</p>
            <input
              style={s.numInput}
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
            />
          </>
        )}

        <button style={s.primaryBtn} onClick={handleCreate} disabled={creating}>
          {creating ? 'Generating…' : 'Generate codes'}
        </button>
      </div>

      <p style={s.meta}>{invites.length} codes · {usedCount} redeemed · {invites.length - usedCount} available</p>

      {loading ? <p>Loading…</p> : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Code</th>
              <th style={s.th}>Label</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Redeemed by</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {invites.map(i => (
              <tr key={i.id} style={s.tr}>
                <td style={{ ...s.td, ...s.mono }}>{i.code}</td>
                <td style={s.td}>{i.label ?? <em style={{ color: '#aaa' }}>—</em>}</td>
                <td style={s.td}>
                  {i.usedByUserId
                    ? <span style={s.used}>Used</span>
                    : <span style={s.available}>Available</span>}
                </td>
                <td style={s.td}>
                  {i.usedBy?.displayName ?? (i.usedByUserId ? <em style={{ color: '#aaa' }}>unnamed</em> : '—')}
                </td>
                <td style={{ ...s.td, textAlign: 'right' }}>
                  <button style={s.linkBtn} onClick={() => copy(i.code)}>Copy</button>
                  {!i.usedByUserId && (
                    <button style={{ ...s.linkBtn, color: '#e74c3c' }} onClick={() => handleDelete(i.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && invites.length === 0 && (
        <p style={{ color: '#999', marginTop: 24, textAlign: 'center' }}>No codes yet — generate some above.</p>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  exportBtn: { background: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  card: { background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20 },
  modeRow: { display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' },
  radio: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' },
  hint: { fontSize: 13, color: '#666', margin: '0 0 10px' },
  textarea: { width: '100%', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 14, fontFamily: 'monospace', marginBottom: 12 },
  numInput: { width: 120, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 14, marginBottom: 12, display: 'block' },
  primaryBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  meta: { fontSize: 13, color: '#666', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { background: '#f0f0f7', padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700 },
  tr: { borderTop: '1px solid #eee' },
  td: { padding: '10px 16px', fontSize: 13 },
  mono: { fontFamily: 'monospace', fontSize: 14, fontWeight: 700, letterSpacing: 1 },
  used: { color: '#888', fontSize: 12, fontWeight: 600 },
  available: { color: '#22c55e', fontSize: 12, fontWeight: 600 },
  linkBtn: { background: 'none', border: 'none', color: '#1a1a2e', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 8 },
};
