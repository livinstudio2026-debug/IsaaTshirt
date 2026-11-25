// One CSV cell. Quoted when it has a comma, quote or line break. A cell that starts with = + - @ (or a tab / return) would be run as a
// formula by Excel and Sheets, so it gets a leading apostrophe: a stranger who signs up as "=HYPERLINK(...)" can't attack whoever opens the file.
export function csvCell(value) {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
export const csvRow = (cells) => cells.map(csvCell).join(',')
