// Build a CSV string from an array of flat objects and trigger a browser download.
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return; // nothing to export; callers disable the button when empty

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    let s = value == null ? '' : String(value);
    // Neutralize CSV formula injection: a cell beginning with = + - @ (or a
    // leading tab/CR) is treated as a formula by Excel/Sheets. Prefix with '
    // so participant-entered text can't execute when the export is opened.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
