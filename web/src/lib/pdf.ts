// Tiny dependency-free PDF writer for the sample report export: Helvetica text, simple tables, and a
// diagonal watermark on every page. ASCII only: other characters are mapped to close ASCII ones.

export type Block =
  | { type: 'h1' | 'h2' | 'p' | 'note'; text: string }
  | { type: 'kv'; rows: [string, string][] }
  | { type: 'table'; columns: { title: string; width: number; align?: 'left' | 'right' }[]; rows: string[][] }
  | { type: 'space'; height?: number }

export interface PdfDoc {
  title: string
  watermark: string
  footer: string
  blocks: Block[]
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 48

const MAP: Record<string, string> = { '−': '-', '–': '-', '—': '-', '·': '|', '’': "'", '‘': "'", '“': '"', '”': '"', '×': 'x', '…': '...', '≤': '<=', '≥': '>=', '→': '->', ' ': ' ' }

export function ascii(s: string): string {
  return Array.from(s)
    .map((ch) => (MAP[ch] ?? (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126 ? '?' : ch)))
    .join('')
}

const esc = (s: string) => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

// Helvetica average character width is about 0.5 em; good enough for wrapping and column clipping.
const charsFor = (width: number, size: number) => Math.max(1, Math.floor(width / (size * 0.5)))

function wrap(text: string, width: number, size: number): string[] {
  const max = charsFor(width, size)
  const out: string[] = []
  for (const para of ascii(text).split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if (!word) continue
      if ((line + ' ' + word).trim().length > max) {
        if (line) out.push(line)
        line = word
      } else line = (line + ' ' + word).trim()
    }
    out.push(line)
  }
  return out
}

const clip = (s: string, width: number, size: number) => {
  const max = charsFor(width, size)
  const a = ascii(s)
  return a.length > max ? a.slice(0, Math.max(1, max - 1)) + '.' : a
}

export function buildPdf(doc: PdfDoc): Uint8Array {
  const pages: string[][] = [[]]
  let y = PAGE_H - MARGIN
  const cur = () => pages[pages.length - 1]
  const newPage = () => {
    pages.push([])
    y = PAGE_H - MARGIN
  }
  const need = (h: number) => {
    if (y - h < MARGIN + 24) newPage()
  }
  const text = (x: number, yy: number, str: string, size: number, bold = false, gray = 0) => cur().push(`BT ${gray} g /F${bold ? 2 : 1} ${size} Tf ${x} ${yy} Td (${esc(str)}) Tj ET`)
  const rule = (yy: number) => cur().push(`0.8 G 0.5 w ${MARGIN} ${yy} m ${PAGE_W - MARGIN} ${yy} l S`)

  for (const b of doc.blocks) {
    if (b.type === 'space') {
      y -= b.height ?? 10
    } else if (b.type === 'h1' || b.type === 'h2') {
      const size = b.type === 'h1' ? 18 : 12
      need(size + 14)
      y -= size
      text(MARGIN, y, b.text, size, true)
      y -= 8
    } else if (b.type === 'p' || b.type === 'note') {
      const size = b.type === 'note' ? 8.5 : 10
      for (const line of wrap(b.text, PAGE_W - 2 * MARGIN, size)) {
        need(size + 4)
        y -= size + 3
        text(MARGIN, y, line, size, false, b.type === 'note' ? 0.35 : 0)
      }
      y -= 4
    } else if (b.type === 'kv') {
      for (const [k, v] of b.rows) {
        need(16)
        y -= 14
        text(MARGIN, y, k, 10, true)
        text(MARGIN + 150, y, clip(v, PAGE_W - 2 * MARGIN - 150, 10), 10)
      }
      y -= 4
    } else if (b.type === 'table') {
      const drawHead = () => {
        need(22)
        y -= 14
        let x = MARGIN
        for (const c of b.columns) {
          const label = clip(c.title, c.width - 4, 8.5)
          text(c.align === 'right' ? x + c.width - 4 - label.length * 8.5 * 0.5 : x, y, label, 8.5, true)
          x += c.width
        }
        y -= 4
        rule(y)
      }
      drawHead()
      for (const row of b.rows) {
        if (y - 14 < MARGIN + 24) {
          newPage()
          drawHead()
        }
        y -= 13
        let x = MARGIN
        b.columns.forEach((c, i) => {
          const val = clip(row[i] ?? '', c.width - 4, 8.5)
          text(c.align === 'right' ? x + c.width - 4 - val.length * 8.5 * 0.5 : x, y, val, 8.5)
          x += c.width
        })
      }
      y -= 6
    }
  }

  // Watermark first on each page (so text sits over it), then the footer.
  const streams = pages.map((p, i) => {
    const wm = `q 0.88 g BT /F2 120 Tf 0.7071 0.7071 -0.7071 0.7071 110 260 Tm (${esc(doc.watermark)}) Tj ET Q`
    const foot = `BT 0.4 g /F1 8 Tf ${MARGIN} 28 Td (${esc(`${doc.footer} | Page ${i + 1} of ${pages.length}`)}) Tj ET`
    return [wm, ...p, foot].join('\n')
  })

  const objs: string[] = []
  const add = (body: string) => objs.push(body) // object number = index + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add(`<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  streams.forEach((st, i) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`)
    add(`<< /Length ${st.length} >>\nstream\n${st}\nendstream`)
  })

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info << /Title (${esc(doc.title)}) >> >>\nstartxref\n${xref}\n%%EOF\n`

  const bytes = new Uint8Array(out.length)
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return bytes
}
