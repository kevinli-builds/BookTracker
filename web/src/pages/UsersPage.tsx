import React, { useEffect, useState } from 'react';
import {
  AdminUser,
  GoalTemplate,
  UserDetail,
  assignGoals,
  assignGroups,
  getAdminGoals,
  getAllLogs,
  getStudyConfig,
  getUserDetail,
  getUsers,
  setHideTrackingGroups,
} from '../api/client';
import { downloadCsv } from '../lib/csv';
import { ExportButton, PageHeader, tableStyles } from '../components/ui';
import ParticipantDetail from '../components/ParticipantDetail';

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
  const [groupNames, setGroupNames] = useState('tracking, control');
  const [groupTarget, setGroupTarget] = useState<'unassigned' | 'all' | 'selected'>('unassigned');
  const [grouping, setGrouping] = useState(false);
  const [groupResult, setGroupResult] = useState<string | null>(null);
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);

  const loadUsers = () => getUsers().then(setUsers);

  useEffect(() => {
    Promise.all([getUsers(), getAdminGoals(), getStudyConfig()])
      .then(([u, t, cfg]) => { setUsers(u); setTemplates(t); setHiddenGroups(cfg.hideTrackingGroups); })
      .finally(() => setLoading(false));
  }, []);

  // Distinct groups currently in use, unioned with any already flagged hidden.
  const groupsInUse = [...new Set([
    ...users.map(u => u.studyGroup).filter((g): g is string => !!g),
    ...hiddenGroups,
  ])].sort();

  const toggleHidden = async (group: string) => {
    const next = hiddenGroups.includes(group)
      ? hiddenGroups.filter(g => g !== group)
      : [...hiddenGroups, group];
    setHiddenGroups(next); // optimistic
    const res = await setHideTrackingGroups(next);
    setHiddenGroups(res.hideTrackingGroups);
  };

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
        (u.inviteCode?.code ?? '').toLowerCase().includes(q) ||
        (u.studyGroup ?? '').toLowerCase().includes(q))
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

  const handleAssignGroups = async () => {
    const groups = groupNames.split(',').map(g => g.trim()).filter(Boolean);
    if (groups.length < 2) { setGroupResult('Enter at least two group names, separated by commas.'); return; }
    if (groupTarget === 'selected' && selected.size === 0) { setGroupResult('Select participants first, or choose a different target.'); return; }
    setGrouping(true);
    setGroupResult(null);
    try {
      const res = await assignGroups({
        groups,
        target: groupTarget,
        userIds: groupTarget === 'selected' ? Array.from(selected) : undefined,
      });
      const summary = Object.entries(res.byGroup).map(([g, n]) => `${g}: ${n}`).join(', ');
      setGroupResult(`Randomly assigned ${res.assigned} participant(s) — ${summary}.`);
      setSelected(new Set());
      await loadUsers();
    } catch {
      setGroupResult('Group assignment failed. Try again.');
    } finally {
      setGrouping(false);
    }
  };

  const exportUsers = () => {
    downloadCsv(
      `booktracker-participants-${new Date().toISOString().slice(0, 10)}.csv`,
      users.map(u => ({
        invite_code: u.inviteCode?.code ?? '',
        participant_label: u.inviteCode?.label ?? '',
        display_name: u.displayName ?? '',
        study_group: u.studyGroup ?? '',
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
        study_group: l.user?.studyGroup ?? '',
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
        placeholder="Search by name, participant ID, code, or group…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div style={s.groupBox}>
        <strong style={{ fontSize: 14 }}>Study groups</strong>
        <p style={s.groupSub}>Randomly assign participants to experimental conditions. You can also set or change any individual's group via “Manage”.</p>
        <div style={s.groupRow}>
          <input
            style={{ ...s.input, flex: 1, minWidth: 200 }}
            value={groupNames}
            onChange={e => setGroupNames(e.target.value)}
            placeholder="Group names, comma-separated (e.g. tracking, control)"
          />
          <select style={s.input} value={groupTarget} onChange={e => setGroupTarget(e.target.value as typeof groupTarget)}>
            <option value="unassigned">Ungrouped only</option>
            <option value="all">All participants</option>
            <option value="selected">Selected only</option>
          </select>
          <button style={s.primaryBtn} onClick={handleAssignGroups} disabled={grouping}>
            {grouping ? 'Assigning…' : 'Randomly assign'}
          </button>
        </div>
        {groupResult && <p style={s.result}>{groupResult}</p>}

        {groupsInUse.length > 0 && (
          <div style={s.hideBox}>
            <span style={s.meta}>App experience per group — by default everyone sees tracking (logging &amp; goals). Tick a group to hide tracking, giving it a check-in-only app:</span>
            <div style={s.hideRow}>
              {groupsInUse.map(g => (
                <label key={g} style={s.hideChip}>
                  <input type="checkbox" checked={hiddenGroups.includes(g)} onChange={() => toggleHidden(g)} />
                  <span style={s.groupTag}>{g}</span>
                  <span style={{ fontSize: 12, color: '#666' }}>{hiddenGroups.includes(g) ? 'check-in only' : 'full app'}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

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
            <th style={s.th}>Group</th>
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
                {u.studyGroup
                  ? <span style={s.groupTag}>{u.studyGroup}</span>
                  : <span style={{ color: '#bbb' }}>—</span>}
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

const s: Record<string, React.CSSProperties> = {
  searchInput: { width: '100%', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px', fontSize: 14, marginBottom: 14 },
  groupBox: { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #eee' },
  groupSub: { fontSize: 13, color: '#666', margin: '4px 0 12px' },
  groupRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  hideBox: { marginTop: 14, paddingTop: 12, borderTop: '1px solid #eee' },
  hideRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 },
  hideChip: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' },
  input: { border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' },
  groupTag: { background: '#ede9fe', color: '#6d28d9', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
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
};
