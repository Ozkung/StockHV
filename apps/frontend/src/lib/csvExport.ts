export interface CsvColumn {
  key: string;
  label: string;
}

function escapeCsvValue(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCsv(filename: string, rows: Record<string, any>[], columns: CsvColumn[]) {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(',')).join('\n');
  // Leading BOM so Excel renders Thai/UTF-8 text correctly
  const csv = '﻿' + [header, body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
