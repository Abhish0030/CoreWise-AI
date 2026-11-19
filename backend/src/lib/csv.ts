// RFC4180 quoting alone does not prevent spreadsheet formula evaluation.
// Preserve typed negative numbers; escape potentially executable string cells.
export function csvCell(value: unknown) {
  let text = String(value ?? '').replaceAll('\u0000', '');
  if (typeof value === 'string' && /^[\u0000-\u0020\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function safeCsv(rows: Record<string, unknown>[], columns = Object.keys(rows[0] ?? {})) {
  return [
    columns.map(csvCell).join(','),
    ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')),
  ].join('\r\n');
}
