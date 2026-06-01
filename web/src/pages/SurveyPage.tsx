import React, { useEffect, useState } from 'react';
import {
  SurveyQuestion,
  createSurveyQuestion,
  deleteSurveyQuestion,
  getSurveyConfig,
  getSurveyQuestions,
  getSurveyResponses,
  loadStandardQuestions,
  setSurveyCadence,
  updateSurveyQuestion,
} from '../api/client';
import { downloadCsv } from '../lib/csv';
import { ConfirmDialog, ExportButton, PageHeader } from '../components/ui';

const TYPE_LABEL: Record<string, string> = { number: 'Number', rating: 'Rating (1–5)', text: 'Text' };

export default function SurveyPage() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [cadence, setCadence] = useState(7);
  const [cadenceDraft, setCadenceDraft] = useState('7');
  const [loading, setLoading] = useState(true);
  const [newPrompt, setNewPrompt] = useState('');
  const [newType, setNewType] = useState<'number' | 'rating' | 'text'>('number');
  const [newRequired, setNewRequired] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<SurveyQuestion | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getSurveyConfig(), getSurveyQuestions(), getSurveyResponses()])
      .then(([c, q, r]) => {
        setCadence(c.cadenceDays);
        setCadenceDraft(String(c.cadenceDays));
        setQuestions(q);
        setResponseCount(r.responses.length);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const active = questions.filter(q => q.active);

  const saveCadence = async () => {
    const n = parseInt(cadenceDraft, 10);
    if (!n || n < 1) return;
    await setSurveyCadence(n);
    setCadence(n);
  };

  const addQuestion = async () => {
    if (!newPrompt.trim()) return;
    await createSurveyQuestion({ prompt: newPrompt.trim(), type: newType, required: newRequired });
    setNewPrompt(''); setNewType('number'); setNewRequired(false);
    load();
  };

  const move = async (q: SurveyQuestion, dir: -1 | 1) => {
    const idx = active.findIndex(x => x.id === q.id);
    const swap = active[idx + dir];
    if (!swap) return;
    await Promise.all([
      updateSurveyQuestion(q.id, { sortOrder: swap.sortOrder }),
      updateSurveyQuestion(swap.id, { sortOrder: q.sortOrder }),
    ]);
    load();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteSurveyQuestion(pendingDelete.id);
    setPendingDelete(null);
    load();
  };

  const exportResponses = async () => {
    const { questions: qs, responses } = await getSurveyResponses();
    downloadCsv(
      `booktracker-checkins-${new Date().toISOString().slice(0, 10)}.csv`,
      responses.map(r => {
        const row: Record<string, unknown> = {
          invite_code: r.inviteCode ?? '',
          participant_label: r.participantLabel ?? '',
          display_name: r.participant ?? '',
          study_group: r.studyGroup ?? '',
          user_id: r.userId,
          submitted_at: new Date(r.submittedAt).toISOString(),
        };
        // One column per question (by prompt), matched by question id.
        qs.forEach(q => { row[q.prompt] = r.answers?.[q.id] ?? ''; });
        return row;
      })
    );
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <PageHeader title="Check-in Survey">
        <ExportButton onClick={exportResponses} disabled={responseCount === 0}>Export responses CSV</ExportButton>
      </PageHeader>

      <p style={s.intro}>
        Every participant (both tracking and control groups) is prompted to complete this check-in on a
        recurring schedule. It’s your common outcome measure across conditions. Edit the questions and
        cadence below — changes apply to everyone immediately.
      </p>

      <div style={s.card}>
        <strong style={s.cardTitle}>Cadence</strong>
        <div style={s.cadenceRow}>
          <span>Prompt each participant every</span>
          <input style={s.numInput} type="number" min={1} max={365} value={cadenceDraft} onChange={e => setCadenceDraft(e.target.value)} />
          <span>days.</span>
          <button style={s.primaryBtn} onClick={saveCadence} disabled={parseInt(cadenceDraft, 10) === cadence}>Save</button>
        </div>
      </div>

      <div style={s.card}>
        <strong style={s.cardTitle}>Questions ({active.length})</strong>
        {active.length === 0 && (
          <div style={s.emptyState}>
            <p style={{ margin: '8px 0' }}>No questions yet.</p>
            <button style={s.primaryBtn} onClick={async () => { await loadStandardQuestions(); load(); }}>
              Load the standard reading check-in
            </button>
          </div>
        )}
        {active.map((q, i) => (
          <div key={q.id} style={s.qRow}>
            <div style={s.qOrder}>
              <button style={s.arrow} disabled={i === 0} onClick={() => move(q, -1)}>↑</button>
              <button style={s.arrow} disabled={i === active.length - 1} onClick={() => move(q, 1)}>↓</button>
            </div>
            <div style={{ flex: 1 }}>
              <div style={s.qPrompt}>{q.prompt}</div>
              <div style={s.qMeta}>
                <span style={s.typeTag}>{TYPE_LABEL[q.type]}</span>
                <label style={s.reqLabel}>
                  <input type="checkbox" checked={q.required} onChange={e => updateSurveyQuestion(q.id, { required: e.target.checked }).then(load)} />
                  required
                </label>
              </div>
            </div>
            <button style={s.removeBtn} onClick={() => setPendingDelete(q)}>Remove</button>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <strong style={s.cardTitle}>Add a question</strong>
        <div style={s.addRow}>
          <input style={{ ...s.input, flex: 1, minWidth: 220 }} value={newPrompt} placeholder="Question text (e.g. How many books did you finish?)" onChange={e => setNewPrompt(e.target.value)} />
          <select style={s.input} value={newType} onChange={e => setNewType(e.target.value as typeof newType)}>
            <option value="number">Number</option>
            <option value="rating">Rating (1–5)</option>
            <option value="text">Text</option>
          </select>
          <label style={s.reqLabel}>
            <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} />
            required
          </label>
          <button style={s.primaryBtn} onClick={addQuestion} disabled={!newPrompt.trim()}>Add</button>
        </div>
      </div>

      <p style={s.meta}>{responseCount} check-in response(s) collected.</p>

      {pendingDelete && (
        <ConfirmDialog
          message={`Remove “${pendingDelete.prompt}” from the survey? Past responses are kept for export.`}
          confirmLabel="Remove"
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  intro: { fontSize: 13, color: '#555', background: '#f0f4ff', border: '1px solid #d8e0ff', borderRadius: 10, padding: '12px 16px', lineHeight: 1.6, marginBottom: 16 },
  card: { background: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, border: '1px solid #eee' },
  cardTitle: { fontSize: 14, display: 'block', marginBottom: 12 },
  cadenceRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, flexWrap: 'wrap' },
  numInput: { width: 80, border: '1px solid #ddd', borderRadius: 8, padding: '7px 10px', fontSize: 14 },
  input: { border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' },
  primaryBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  emptyState: { textAlign: 'center', padding: '8px 0 4px' },
  qRow: { display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f0f0f0', padding: '10px 0' },
  qOrder: { display: 'flex', flexDirection: 'column', gap: 2 },
  arrow: { background: '#f0f0f7', border: 'none', borderRadius: 4, width: 24, height: 20, cursor: 'pointer', fontSize: 11, lineHeight: 1 },
  qPrompt: { fontSize: 14, fontWeight: 500 },
  qMeta: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 },
  typeTag: { background: '#e0e7ff', color: '#3730a3', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600 },
  reqLabel: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#555', cursor: 'pointer' },
  removeBtn: { background: '#fff1f2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13 },
  addRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  meta: { fontSize: 13, color: '#666' },
};
