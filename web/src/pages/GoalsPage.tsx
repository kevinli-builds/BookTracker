import React, { FormEvent, useEffect, useState } from 'react';
import {
  BookResult,
  GoalTemplate,
  assignGoals,
  createGoal,
  deleteGoal,
  getAdminGoals,
  searchBooks,
  updateGoal,
} from '../api/client';
import { ConfirmDialog, PageHeader } from '../components/ui';

// Friendly goal types. `value` is what's stored in the DB (unchanged); `label`
// is what the researcher sees; `field` drives which graphical input we show.
const GOAL_TYPES: { value: string; label: string; field: 'count' | 'pages' | 'minutes' | 'genre' | 'author' | 'book' | 'none' }[] = [
  { value: 'books_count', label: 'Read a number of books', field: 'count' },
  { value: 'pages', label: 'Read a number of pages', field: 'pages' },
  { value: 'specific_book', label: 'Read a specific book', field: 'book' },
  { value: 'minutes', label: 'Read for a number of minutes', field: 'minutes' },
  { value: 'genre', label: 'Read a specific genre', field: 'genre' },
  { value: 'author', label: 'Read books by an author', field: 'author' },
  { value: 'custom', label: 'Custom goal (described in text)', field: 'none' },
];

const SHORT_LABEL: Record<string, string> = {
  books_count: 'Books',
  pages: 'Pages',
  specific_book: 'Book',
  minutes: 'Minutes',
  genre: 'Genre',
  author: 'Author',
  custom: 'Custom',
};

interface FormState {
  title: string;
  description: string;
  type: string;
  randomPool: boolean;
  count: string;
  pages: string;
  minutes: string;
  genre: string;
  author: string;
  bookId: string;
  bookTitle: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  type: 'books_count',
  randomPool: false,
  count: '',
  pages: '',
  minutes: '',
  genre: '',
  author: '',
  bookId: '',
  bookTitle: '',
};

// Build the stored criteria object from the graphical fields, with validation.
function buildCriteria(form: FormState): { criteria: Record<string, unknown> } | { error: string } {
  const fieldFor = GOAL_TYPES.find(t => t.value === form.type)?.field ?? 'none';
  switch (fieldFor) {
    case 'count': {
      const n = parseInt(form.count, 10);
      if (!n || n < 1) return { error: 'Enter how many books to read (1 or more).' };
      return { criteria: { count: n } };
    }
    case 'pages': {
      const n = parseInt(form.pages, 10);
      if (!n || n < 1) return { error: 'Enter how many pages to read (1 or more).' };
      return { criteria: { pages: n } };
    }
    case 'minutes': {
      const n = parseInt(form.minutes, 10);
      if (!n || n < 1) return { error: 'Enter how many minutes to read (1 or more).' };
      return { criteria: { minutes: n } };
    }
    case 'genre':
      if (!form.genre.trim()) return { error: 'Enter a genre.' };
      return { criteria: { genre: form.genre.trim() } };
    case 'author':
      if (!form.author.trim()) return { error: 'Enter an author name.' };
      return { criteria: { author: form.author.trim() } };
    case 'book':
      if (!form.bookId) return { error: 'Search for and pick the specific book.' };
      return { criteria: { googleBooksId: form.bookId, title: form.bookTitle } };
    default:
      return { criteria: {} };
  }
}

// Human-readable summary of a saved goal's target, shown on the card.
function targetSummary(t: GoalTemplate): string | null {
  const c = (t.criteria ?? {}) as Record<string, unknown>;
  if (typeof c.count === 'number') return `${c.count} book${c.count === 1 ? '' : 's'}`;
  if (typeof c.pages === 'number') return `${c.pages} pages`;
  if (typeof c.minutes === 'number') return `${c.minutes} minutes`;
  if (typeof c.genre === 'string' && c.genre) return `Genre: ${c.genre}`;
  if (typeof c.author === 'string' && c.author) return `Author: ${c.author}`;
  if (typeof c.googleBooksId === 'string' && c.googleBooksId) return `Book: ${typeof c.title === 'string' ? c.title : 'selected'}`;
  return null;
}

export default function GoalsPage() {
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GoalTemplate | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<GoalTemplate | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Book search state for the "read a specific book" goal type.
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<BookResult[]>([]);
  const [bookSearching, setBookSearching] = useState(false);

  const runBookSearch = async () => {
    if (!bookQuery.trim()) return;
    setBookSearching(true);
    try {
      setBookResults(await searchBooks(bookQuery.trim()));
    } catch {
      setBookResults([]);
    } finally {
      setBookSearching(false);
    }
  };

  const reload = () => getAdminGoals().then(setTemplates).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const resetBookSearch = () => { setBookQuery(''); setBookResults([]); };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    resetBookSearch();
    setShowForm(true);
  };

  const openEdit = (t: GoalTemplate) => {
    const c = (t.criteria ?? {}) as Record<string, unknown>;
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description,
      type: t.type,
      randomPool: t.randomPool,
      count: typeof c.count === 'number' ? String(c.count) : '',
      pages: typeof c.pages === 'number' ? String(c.pages) : '',
      minutes: typeof c.minutes === 'number' ? String(c.minutes) : '',
      genre: typeof c.genre === 'string' ? c.genre : '',
      author: typeof c.author === 'string' ? c.author : '',
      bookId: typeof c.googleBooksId === 'string' ? c.googleBooksId : '',
      bookTitle: typeof c.title === 'string' ? c.title : '',
    });
    setFormError('');
    resetBookSearch();
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const result = buildCriteria(form);
    if ('error' in result) { setFormError(result.error); return; }

    const payload = {
      title: form.title,
      description: form.description,
      type: form.type,
      randomPool: form.randomPool,
      criteria: result.criteria,
    };
    if (editing) {
      await updateGoal(editing.id, payload);
    } else {
      await createGoal(payload);
    }
    setShowForm(false);
    reload();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteGoal(pendingDelete.id);
    setPendingDelete(null);
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

  const activeField = GOAL_TYPES.find(t => t.value === form.type)?.field ?? 'none';

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <PageHeader title="Goal Templates">
        <button style={s.primaryBtn} onClick={openNew}>+ New Goal</button>
      </PageHeader>

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
          {templates.map(t => {
            const target = targetSummary(t);
            return (
              <div key={t.id} style={s.card}>
                <div style={s.cardTop}>
                  <span style={s.tag}>{SHORT_LABEL[t.type] ?? t.type}</span>
                  {t.randomPool && <span style={s.poolTag}>Random Pool</span>}
                </div>
                <div style={s.cardTitle}>{t.title}</div>
                <div style={s.cardDesc}>{t.description}</div>
                {target && <div style={s.cardTarget}>🎯 {target}</div>}
                <div style={s.cardMeta}>
                  {t._count?.userGoals ?? 0} assigned
                </div>
                <div style={s.cardActions}>
                  <button style={s.editBtn} onClick={() => openEdit(t)}>Edit</button>
                  <button style={s.deleteBtn} onClick={() => setPendingDelete(t)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div style={s.overlay}>
          <form style={s.modal} onSubmit={submit}>
            <h2 style={s.modalTitle}>{editing ? 'Edit Goal' : 'New Goal Template'}</h2>

            <label style={s.label}>Title</label>
            <input style={s.input} value={form.title} placeholder="e.g. Read 5 books this month" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />

            <label style={s.label}>Description</label>
            <textarea style={{ ...s.input, height: 72 }} value={form.description} placeholder="What should the participant do?" onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />

            <label style={s.label}>Goal type</label>
            <select style={s.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {GOAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {activeField === 'count' && (
              <>
                <label style={s.label}>Number of books</label>
                <input style={s.input} type="number" min={1} value={form.count} placeholder="e.g. 5" onChange={e => setForm(f => ({ ...f, count: e.target.value }))} />
              </>
            )}
            {activeField === 'pages' && (
              <>
                <label style={s.label}>Number of pages</label>
                <input style={s.input} type="number" min={1} value={form.pages} placeholder="e.g. 1000" onChange={e => setForm(f => ({ ...f, pages: e.target.value }))} />
                <p style={s.fieldHint}>Counts each logged book’s page count. Books with no known length count as 0.</p>
              </>
            )}
            {activeField === 'book' && (
              <>
                <label style={s.label}>Which book?</label>
                {form.bookId ? (
                  <div style={s.pickedBook}>
                    <span>📖 {form.bookTitle}</span>
                    <button type="button" style={s.changeBookBtn} onClick={() => { setForm(f => ({ ...f, bookId: '', bookTitle: '' })); resetBookSearch(); }}>Change</button>
                  </div>
                ) : (
                  <>
                    <div style={s.bookSearchRow}>
                      <input
                        style={s.input}
                        value={bookQuery}
                        placeholder="Search by title or author"
                        onChange={e => setBookQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runBookSearch(); } }}
                      />
                      <button type="button" style={s.searchBtn} onClick={runBookSearch} disabled={bookSearching}>
                        {bookSearching ? '…' : 'Search'}
                      </button>
                    </div>
                    {bookResults.length > 0 && (
                      <div style={s.bookResults}>
                        {bookResults.map(b => (
                          <button
                            type="button"
                            key={b.id}
                            style={s.bookResult}
                            onClick={() => { setForm(f => ({ ...f, bookId: b.id, bookTitle: b.title })); setBookResults([]); }}
                          >
                            <strong>{b.title}</strong>{b.author ? ` — ${b.author}` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {activeField === 'minutes' && (
              <>
                <label style={s.label}>Number of minutes</label>
                <input style={s.input} type="number" min={1} value={form.minutes} placeholder="e.g. 300" onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} />
              </>
            )}
            {activeField === 'genre' && (
              <>
                <label style={s.label}>Genre</label>
                <input style={s.input} value={form.genre} placeholder="e.g. Mystery" onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />
              </>
            )}
            {activeField === 'author' && (
              <>
                <label style={s.label}>Author</label>
                <input style={s.input} value={form.author} placeholder="e.g. Toni Morrison" onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </>
            )}
            {activeField === 'none' && (
              <p style={s.customHint}>This goal has no numeric target — the title and description tell the participant what to do.</p>
            )}

            <label style={s.checkRow}>
              <input type="checkbox" checked={form.randomPool} onChange={e => setForm(f => ({ ...f, randomPool: e.target.checked }))} />
              <span>Include in random assignment pool</span>
            </label>

            {formError && <p style={s.formError}>{formError}</p>}

            <div style={s.modalBtns}>
              <button type="submit" style={s.primaryBtn}>{editing ? 'Save' : 'Create'}</button>
              <button type="button" style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={`Delete goal “${pendingDelete.title}”? This cannot be undone.`}
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
  cardTarget: { fontSize: 13, color: '#1a1a2e', fontWeight: 600, marginBottom: 8 },
  cardMeta: { fontSize: 12, color: '#999', marginBottom: 12 },
  cardActions: { display: 'flex', gap: 8 },
  editBtn: { background: '#f0f0f7', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13 },
  deleteBtn: { background: '#fff1f2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: '#fff', borderRadius: 16, padding: 32, width: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 },
  modalTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 6 },
  input: { border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  customHint: { fontSize: 13, color: '#888', background: '#f7f7fb', borderRadius: 8, padding: 10, marginTop: 6 },
  fieldHint: { fontSize: 12, color: '#888', margin: '4px 0 0' },
  bookSearchRow: { display: 'flex', gap: 8 },
  searchBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  bookResults: { border: '1px solid #eee', borderRadius: 8, marginTop: 8, maxHeight: 200, overflowY: 'auto' },
  bookResult: { display: 'block', width: '100%', textAlign: 'left', background: '#fff', border: 'none', borderBottom: '1px solid #f0f0f0', padding: '8px 10px', cursor: 'pointer', fontSize: 13 },
  pickedBook: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: '#f0f4ff', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginTop: 4 },
  changeBookBtn: { background: 'transparent', border: '1px solid #c7d2fe', color: '#3730a3', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, cursor: 'pointer' },
  formError: { color: '#ef4444', fontSize: 13, marginTop: 10 },
  modalBtns: { display: 'flex', gap: 10, marginTop: 16 },
  cancelBtn: { background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 },
};
