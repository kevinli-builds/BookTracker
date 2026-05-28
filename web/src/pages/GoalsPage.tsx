import React, { FormEvent, useEffect, useState } from 'react';
import {
  GoalTemplate,
  assignGoals,
  createGoal,
  deleteGoal,
  getAdminGoals,
  updateGoal,
} from '../api/client';

const GOAL_TYPES = ['books_count', 'minutes', 'genre', 'author', 'custom'];

export default function GoalsPage() {
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GoalTemplate | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);
  const [deadline, setDeadline] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'books_count',
    criteria: '{}',
    randomPool: false,
  });

  const reload = () => getAdminGoals().then(setTemplates).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', description: '', type: 'books_count', criteria: '{}', randomPool: false });
    setShowForm(true);
  };

  const openEdit = (t: GoalTemplate) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description,
      type: t.type,
      criteria: JSON.stringify(t.criteria, null, 2),
      randomPool: t.randomPool,
    });
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let criteria: Record<string, unknown>;
    try {
      criteria = JSON.parse(form.criteria);
    } catch {
      alert('Criteria must be valid JSON.');
      return;
    }
    const payload = { ...form, criteria };
    if (editing) {
      await updateGoal(editing.id, payload);
    } else {
      await createGoal(payload);
    }
    setShowForm(false);
    reload();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete goal "${title}"? This cannot be undone.`)) return;
    await deleteGoal(id);
    reload();
  };

  const handleAssign = async () => {
    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await assignGoals(undefined, deadline || undefined);
      setAssignResult(`Assigned to ${res.assigned} user(s).`);
    } catch {
      setAssignResult('Assignment failed.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={s.headerRow}>
        <h1 style={s.h1}>Goal Templates</h1>
        <button style={s.primaryBtn} onClick={openNew}>+ New Goal</button>
      </div>

      <div style={s.assignBox}>
        <strong style={{ fontSize: 14 }}>Random Assignment</strong>
        <p style={s.assignSub}>Assign a random pool goal to every user (or set a deadline below).</p>
        <div style={s.assignRow}>
          <input
            style={s.input}
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            placeholder="Deadline (optional)"
          />
          <button style={s.primaryBtn} onClick={handleAssign} disabled={assigning}>
            {assigning ? 'Assigning...' : 'Assign Now'}
          </button>
        </div>
        {assignResult && <p style={s.assignResult}>{assignResult}</p>}
      </div>

      {templates.length === 0 ? (
        <p style={{ color: '#999', marginTop: 24 }}>No goal templates yet. Create one above.</p>
      ) : (
        <div style={s.grid}>
          {templates.map(t => (
            <div key={t.id} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.tag}>{t.type}</span>
                {t.randomPool && <span style={s.poolTag}>Random Pool</span>}
              </div>
              <div style={s.cardTitle}>{t.title}</div>
              <div style={s.cardDesc}>{t.description}</div>
              <div style={s.cardMeta}>
                {t._count?.userGoals ?? 0} assigned
              </div>
              <div style={s.cardActions}>
                <button style={s.editBtn} onClick={() => openEdit(t)}>Edit</button>
                <button style={s.deleteBtn} onClick={() => handleDelete(t.id, t.title)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={s.overlay}>
          <form style={s.modal} onSubmit={submit}>
            <h2 style={s.modalTitle}>{editing ? 'Edit Goal' : 'New Goal Template'}</h2>
            <label style={s.label}>Title</label>
            <input style={s.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <label style={s.label}>Description</label>
            <textarea style={{ ...s.input, height: 72 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            <label style={s.label}>Type</label>
            <select style={s.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {GOAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={s.label}>Criteria (JSON)</label>
            <textarea
              style={{ ...s.input, height: 80, fontFamily: 'monospace', fontSize: 12 }}
              value={form.criteria}
              onChange={e => setForm(f => ({ ...f, criteria: e.target.value }))}
            />
            <label style={s.checkRow}>
              <input type="checkbox" checked={form.randomPool} onChange={e => setForm(f => ({ ...f, randomPool: e.target.checked }))} />
              <span>Include in random assignment pool</span>
            </label>
            <div style={s.modalBtns}>
              <button type="submit" style={s.primaryBtn}>{editing ? 'Save' : 'Create'}</button>
              <button type="button" style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1: { fontSize: 24, fontWeight: 800 },
  primaryBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  assignBox: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 28, border: '1px solid #eee' },
  assignSub: { fontSize: 13, color: '#666', margin: '4px 0 12px' },
  assignRow: { display: 'flex', gap: 10, alignItems: 'center' },
  assignResult: { marginTop: 8, fontSize: 13, color: '#22c55e' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  card: { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' },
  cardTop: { display: 'flex', gap: 6, marginBottom: 8 },
  tag: { background: '#e0e7ff', color: '#3730a3', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  poolTag: { background: '#f0fdf4', color: '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#555', marginBottom: 8 },
  cardMeta: { fontSize: 12, color: '#999', marginBottom: 12 },
  cardActions: { display: 'flex', gap: 8 },
  editBtn: { background: '#f0f0f7', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13 },
  deleteBtn: { background: '#fff1f2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: '#fff', borderRadius: 16, padding: 32, width: 480, display: 'flex', flexDirection: 'column', gap: 6 },
  modalTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 6 },
  input: { border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 14, width: '100%' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, cursor: 'pointer' },
  modalBtns: { display: 'flex', gap: 10, marginTop: 12 },
  cancelBtn: { background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 },
};
