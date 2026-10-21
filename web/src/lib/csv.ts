/** RFC 4180 style CSV. Empty cells mean "unavailable", never zero. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    // Guard against spreadsheet formula injection from text cells.
    const safe = /^[=+@-]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function download(filename: string, data: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
