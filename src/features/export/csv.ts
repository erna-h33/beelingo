/** RFC 4180-ish quoting: wrap in quotes and double-up any embedded quote
 * whenever a value contains a comma, quote, or newline -- plain values
 * pass through unquoted for a more readable file. */
function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","))
  // A leading BOM makes Excel (which otherwise guesses the wrong
  // encoding for non-ASCII text like accented vocabulary) open the file
  // as UTF-8 correctly.
  return "﻿" + lines.join("\r\n")
}

/** Client-side-only download -- no server round trip, just a Blob and a
 * throwaway object URL, consistent with this app never needing a
 * backend for anything that doesn't touch the database directly. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
