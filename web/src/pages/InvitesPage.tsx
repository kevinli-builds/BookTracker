import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { InviteCode, createInvites, deleteInvite, getInvites } from '../api/client';
import { downloadCsv } from '../lib/csv';
import { ConfirmDialog, ExportButton, PageHeader, tableStyles } from '../components/ui';

type Mode = 'count' | 'labels';

export default function InvitesPage() {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('labels');
  const [count, setCount] = useState(10);
  const [labelsText, setLabelsText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [appLink, setAppLink] = useState('');
  const [pendingDelete, setPendingDelete] = useState<InviteCode | null>(null);

  const load = () => {
    setLoading(true);
    getInvites().then(setInvites).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setCreateError('');
    setCreating(true);
    try {
      if (mode === 'labels') {
        const labels = labelsText.split('\n').map(l => l.trim()).filter(Boolean);
        if (labels.length === 0) { setCreateError('Enter at least one participant label, one per line.'); return; }
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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteInvite(pendingDelete.id);
    setInvites(prev => prev.filter(i => i.id !== pendingDelete.id));
    setPendingDelete(null);
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
      <PageHeader title="Invite Codes">
        <ExportButton onClick={exportCsv} disabled={invites.length === 0}>Export codes CSV</ExportButton>
      </PageHeader>

      <div style={s.howto}>
        <strong style={s.howtoTitle}>Step 1 · Getting the app onto a participant’s phone</strong>
        <ol style={s.howtoList}>
          <li><strong>Have them install “Expo Go.”</strong> It’s a free app on the Apple App Store (iPhone) and Google Play (Android). BookTracker runs inside Expo Go, so there’s no separate “BookTracker” listing for them to search for.</li>
          <li><strong>Send them your study’s BookTracker link.</strong> When they open that link on their phone it launches BookTracker inside Expo Go — on iPhone they open it in Safari or the Camera app, on Android they tap the link or scan its QR code.</li>
          <li><strong>BookTracker opens.</strong> From here the invite code below takes over.</li>
        </ol>
        <p style={s.howtoNote}>Don’t have a link to share yet? It comes from running the app server — see “Make a shareable QR code” below (there’s a step-by-step for running it yourself). If someone else manages that for you, just ask them for the current link.</p>

        <strong style={{ ...s.howtoTitle, ...s.howtoTitle2 }}>Step 2 · Inviting &amp; tracking participants</strong>
        <ol style={s.howtoList}>
          <li><strong>Generate a code for each participant.</strong> Use “One per participant” and paste your participant IDs (e.g. <code style={s.code}>P001</code>, <code style={s.code}>P002</code>) — one per line. Each person gets a unique, single-use code, and their ID becomes their name in the app.</li>
          <li><strong>Send each person their code</strong> alongside the app link from Step 1. Use the <em>Copy</em> button in the table, or <em>Export codes CSV</em> to hand the whole list (code ↔ participant ID) to whoever runs recruitment.</li>
          <li><strong>They enter it in the BookTracker app.</strong> On first launch the app asks for an invite code. A valid, unused code lets them in; used or invalid codes are rejected.</li>
          <li><strong>Track who’s joined.</strong> Once redeemed, a code shows as “Used” with the participant’s name here, and the same code appears in every data export so you can match reading activity back to who you paid.</li>
        </ol>
        <p style={s.howtoNote}>Tip: keep your master list of code → real person separate from the app. The app only ever sees the participant ID you assign.</p>
      </div>

      <div style={s.qrCard}>
        <strong style={s.howtoTitle}>Make a shareable QR code</strong>
        <p style={s.hint}>
          Paste the BookTracker link (it’s printed when the app server runs
          {' '}<code style={s.code}>npx expo start --tunnel</code>). We’ll turn it into a QR you can drop
          into your recruitment message or show on screen.
        </p>
        <input
          style={s.linkInput}
          placeholder="Paste the exp://… or https://… link here"
          value={appLink}
          onChange={e => setAppLink(e.target.value)}
        />
        {appLink.trim() ? (
          <div style={s.qrRow}>
            <div style={s.qrBox}>
              <QRCodeSVG value={appLink.trim()} size={176} marginSize={2} />
            </div>
            <div style={s.qrSide}>
              <p style={s.qrSideText}>
                Participants point their phone camera at this (after installing Expo Go), or open the link directly.
              </p>
              <ExportButton onClick={() => navigator.clipboard?.writeText(appLink.trim())}>Copy link</ExportButton>
              <p style={s.qrSaveHint}>Save the QR by right-clicking it (or just screenshot this box).</p>
            </div>
          </div>
        ) : (
          <p style={s.qrEmpty}>Enter a link above to generate its QR code.</p>
        )}

        <details style={s.runSteps}>
          <summary style={s.runSummary}>Running the study yourself? Show how to start the app server</summary>
          <div style={s.runBody}>
            <p style={s.runIntro}>
              Do this on a computer you control. It hands the app to participants’ phones while it runs —
              the cloud backend and database are already hosted, so you don’t need any secrets or setup beyond this.
            </p>
            <ol style={s.howtoList}>
              <li><strong>Install Node.js</strong> (version 20 or newer) from <code style={s.code}>nodejs.org</code> — this gives you the <code style={s.code}>node</code> and <code style={s.code}>npm</code> commands the next steps use.</li>
              <li>
                <strong>Download the code from GitHub.</strong> The project lives at{' '}
                <code style={s.code}>github.com/snowwarrior1-alt/BookTracker</code>. Either:
                <ul style={s.subList}>
                  <li><strong>Download a ZIP</strong> — open that page, click the green <em>Code</em> button → <em>Download ZIP</em>, then unzip it; or</li>
                  <li><strong>Clone it</strong> (if you have Git): <pre style={s.pre}>git clone https://github.com/snowwarrior1-alt/BookTracker.git</pre></li>
                </ul>
                If the repo is private, sign in to GitHub with an account that has access (or ask the owner to add you / send the ZIP).
              </li>
              <li><strong>Open a terminal in the project’s <code style={s.code}>app</code> folder</strong> and run:
                <pre style={s.pre}>cd BookTracker/app{'\n'}npm install        (first time only){'\n'}npx expo start --tunnel</pre>
                The first tunnel run installs a helper — say <em>yes</em> if asked. Nothing else (no keys, no database) is needed — the backend is already hosted.
              </li>
              <li><strong>Copy the <code style={s.code}>exp://…</code> link</strong> it prints in the terminal and paste it in the box above to make your QR.</li>
              <li><strong>Leave that terminal open</strong> while participants join. The link only works while it’s running, and a new link is generated each time you restart — so regenerate the QR here whenever you restart.</li>
            </ol>
          </div>
        </details>
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

        {createError && <p style={s.createError}>{createError}</p>}
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
                    <button style={{ ...s.linkBtn, color: '#e74c3c' }} onClick={() => setPendingDelete(i)}>Delete</button>
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

      {pendingDelete && (
        <ConfirmDialog
          message={`Delete unused code ${pendingDelete.code}?`}
          confirmLabel="Delete"
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  table: tableStyles.table,
  th: tableStyles.th,
  tr: tableStyles.tr,
  td: tableStyles.td,
  createError: { color: '#ef4444', fontSize: 13, margin: '0 0 10px' },
  howto: { background: '#f0f4ff', border: '1px solid #d8e0ff', borderRadius: 10, padding: '16px 20px', marginBottom: 20 },
  howtoTitle: { fontSize: 14, color: '#1a1a2e', display: 'block' },
  howtoTitle2: { marginTop: 18 },
  howtoList: { margin: '10px 0 0', paddingLeft: 20, fontSize: 13, color: '#374151', lineHeight: 1.7 },
  howtoNote: { fontSize: 12, color: '#6b7280', margin: '10px 0 0', fontStyle: 'italic' },
  code: { background: '#fff', border: '1px solid #d8e0ff', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: 12 },
  qrCard: { background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20 },
  linkInput: { width: '100%', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px', fontSize: 14, marginBottom: 14 },
  qrRow: { display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' },
  qrBox: { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 12, lineHeight: 0 },
  qrSide: { flex: 1, minWidth: 220 },
  qrSideText: { fontSize: 13, color: '#444', margin: '0 0 10px' },
  qrSaveHint: { fontSize: 12, color: '#888', margin: '10px 0 0' },
  qrEmpty: { fontSize: 13, color: '#aaa', margin: 0 },
  runSteps: { marginTop: 18, borderTop: '1px solid #eee', paddingTop: 14 },
  runSummary: { fontSize: 13, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer' },
  runBody: { marginTop: 10 },
  runIntro: { fontSize: 13, color: '#555', margin: '0 0 10px', lineHeight: 1.6 },
  pre: { background: '#1a1a2e', color: '#f4f4f4', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, overflowX: 'auto', margin: '6px 0' },
  subList: { margin: '6px 0', paddingLeft: 18, lineHeight: 1.6 },
  card: { background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20 },
  modeRow: { display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' },
  radio: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' },
  hint: { fontSize: 13, color: '#666', margin: '0 0 10px' },
  textarea: { width: '100%', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 14, fontFamily: 'monospace', marginBottom: 12 },
  numInput: { width: 120, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 14, marginBottom: 12, display: 'block' },
  primaryBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  meta: { fontSize: 13, color: '#666', marginBottom: 12 },
  mono: { fontFamily: 'monospace', fontSize: 14, fontWeight: 700, letterSpacing: 1 },
  used: { color: '#888', fontSize: 12, fontWeight: 600 },
  available: { color: '#22c55e', fontSize: 12, fontWeight: 600 },
  linkBtn: { background: 'none', border: 'none', color: '#1a1a2e', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 8 },
};
