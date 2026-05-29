import React from 'react';

// ── Shared table styles (used by Dashboard, Data, Participants) ───────────────
export const tableStyles: Record<string, React.CSSProperties> = {
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden' },
  th: { background: '#f0f0f7', padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700 },
  tr: { borderTop: '1px solid #eee' },
  td: { padding: '10px 16px', fontSize: 13 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
};

// ── Page header with optional right-aligned actions ──────────────────────────
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={headerStyles.row}>
      <h1 style={headerStyles.h1}>{title}</h1>
      {children && <div style={headerStyles.actions}>{children}</div>}
    </div>
  );
}

const headerStyles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  actions: { display: 'flex', gap: 8 },
};

// ── Outline "export" button ──────────────────────────────────────────────────
export function ExportButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button style={exportStyle} onClick={onClick} disabled={disabled}>{children}</button>
  );
}

const exportStyle: React.CSSProperties = {
  background: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e',
  borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};

// ── Confirmation modal (replaces native confirm()) ───────────────────────────
export function ConfirmDialog({
  message,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={confirmStyles.overlay} onClick={onCancel}>
      <div style={confirmStyles.modal} onClick={e => e.stopPropagation()}>
        <p style={confirmStyles.message}>{message}</p>
        <div style={confirmStyles.btns}>
          <button style={confirmStyles.cancel} onClick={onCancel}>Cancel</button>
          <button
            style={{ ...confirmStyles.confirm, ...(destructive ? confirmStyles.destructive : {}) }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const confirmStyles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { background: '#fff', borderRadius: 14, padding: 24, width: 360 },
  message: { fontSize: 15, color: '#222', margin: '0 0 20px', lineHeight: 1.5 },
  btns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancel: { background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 },
  confirm: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  destructive: { background: '#ef4444' },
};
