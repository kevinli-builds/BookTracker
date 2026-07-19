// CSV building + browser-download helpers shared by the admin export buttons.

// Build a CSV string from an array of flat objects. Column order comes from
// `headers` when given (required for empty tables, which still get a header
// row); otherwise from the keys of the first row.
export function buildCsv(rows: Record<string, unknown>[], headers?: string[]) {
  const cols = headers ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  const escape = (value: unknown) => {
    let s = value == null ? '' : String(value);
    // Neutralize CSV formula injection: a cell beginning with = + - @ (or a
    // leading tab/CR) is treated as a formula by Excel/Sheets. Prefix with '
    // so participant-entered text can't execute when the export is opened.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [
    cols.join(','),
    ...rows.map(row => cols.map(h => escape(row[h])).join(',')),
  ].join('\n');
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Build a CSV from rows and trigger a browser download.
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return; // nothing to export; callers disable the button when empty
  downloadBlob(filename, new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
}
