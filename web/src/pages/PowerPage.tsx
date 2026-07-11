import React, { useState } from 'react';
import { nTwoProportions, nTwoMeans } from '../lib/power';

// Power calculator (admin-only): how many participants per group the study
// needs. Pure client-side math over ../lib/power — no API calls.

const ALPHAS = [0.05, 0.01, 0.1];
const POWERS = [0.8, 0.9, 0.95];

export default function PowerPage() {
  const [mode, setMode] = useState<'proportions' | 'means'>('proportions');
  const [p1, setP1] = useState('0.20');
  const [p2, setP2] = useState('0.35');
  const [d, setD] = useState('0.5');
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.8);

  const prop = mode === 'proportions' ? nTwoProportions(Number(p1), Number(p2), alpha, power) : null;
  const mean = mode === 'means' ? nTwoMeans(Number(d), alpha, power) : null;

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Power calculator</h1>
      <p style={styles.note}>
        Sample size per group for a two-sided test with equal groups. Plan above the
        number shown — dropout and non-compliance always eat some of it.
      </p>

      <div style={styles.card}>
        <div style={styles.row}>
          <label style={styles.label}>Outcome</label>
          <select style={styles.input} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="proportions">Proportion (e.g. % who hit the goal)</option>
            <option value="means">Mean (e.g. minutes read), via Cohen&apos;s d</option>
          </select>
        </div>

        {mode === 'proportions' ? (
          <>
            <div style={styles.row}>
              <label style={styles.label}>Expected proportion, group A</label>
              <input style={styles.input} value={p1} onChange={(e) => setP1(e.target.value)} inputMode="decimal" />
            </div>
            <div style={styles.row}>
              <label style={styles.label}>Expected proportion, group B</label>
              <input style={styles.input} value={p2} onChange={(e) => setP2(e.target.value)} inputMode="decimal" />
            </div>
          </>
        ) : (
          <div style={styles.row}>
            <label style={styles.label}>Effect size (Cohen&apos;s d — 0.2 small, 0.5 medium, 0.8 large)</label>
            <input style={styles.input} value={d} onChange={(e) => setD(e.target.value)} inputMode="decimal" />
          </div>
        )}

        <div style={styles.row}>
          <label style={styles.label}>Significance level (α, two-sided)</label>
          <select style={styles.input} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))}>
            {ALPHAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Power (1 − β)</label>
          <select style={styles.input} value={power} onChange={(e) => setPower(Number(e.target.value))}>
            {POWERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {mode === 'proportions' && (
          prop ? (
            <div style={styles.result}>
              <div style={styles.big}>{prop.nPerGroupCorrected} per group · {prop.total} total</div>
              <div style={styles.small}>
                Continuity-corrected (Fleiss) — matches published tables. Uncorrected: {prop.nPerGroup} per group.
              </div>
            </div>
          ) : (
            <div style={styles.resultMuted}>Enter two different proportions strictly between 0 and 1.</div>
          )
        )}
        {mode === 'means' && (
          mean ? (
            <div style={styles.result}>
              <div style={styles.big}>{mean.nPerGroup} per group · {mean.total} total</div>
              <div style={styles.small}>
                Normal approximation — the exact t-based figure runs about one participant per group higher.
              </div>
            </div>
          ) : (
            <div style={styles.resultMuted}>Enter an effect size greater than 0.</div>
          )
        )}
      </div>

      <p style={styles.note}>
        Assumptions: two independent groups of equal size, two-sided test. These are
        planning figures, not guarantees — they assume the effect you entered is real.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: '0 auto', padding: '24px 16px' },
  h1: { fontSize: 22, marginBottom: 8 },
  note: { color: '#667', fontSize: 13, lineHeight: 1.5, margin: '8px 0 16px' },
  card: { background: '#fff', border: '1px solid #e2e4ea', borderRadius: 10, padding: 18 },
  row: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  label: { fontSize: 12, color: '#556', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { font: 'inherit', padding: '8px 10px', border: '1px solid #ccd0da', borderRadius: 6 },
  result: { marginTop: 6, padding: '12px 14px', background: '#f0f6f1', border: '1px solid #cfe3d4', borderRadius: 8 },
  resultMuted: { marginTop: 6, padding: '12px 14px', background: '#f6f6f8', border: '1px solid #e2e4ea', borderRadius: 8, color: '#667', fontSize: 13 },
  big: { fontSize: 18, fontWeight: 600 },
  small: { fontSize: 12.5, color: '#556', marginTop: 4 },
};
