import { describe, expect, it } from 'vitest'
import { ascii, buildPdf } from './pdf'

const text = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join('')

describe('pdf writer', () => {
  const doc = { title: 'Sample report', watermark: 'SAMPLE', footer: 'Synthetic sample data', blocks: [{ type: 'h1' as const, text: 'Analytics (sample)' }, { type: 'p' as const, text: 'Impressions −12% · reach unavailable' }] }

  it('writes a well-formed PDF with a watermark', () => {
    const s = text(buildPdf(doc))
    expect(s.startsWith('%PDF-1.4')).toBe(true)
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(s).toContain('(SAMPLE) Tj')
    expect(s).toContain('/Count 1')
  })

  it('cross-reference offsets point at their objects', () => {
    const s = text(buildPdf(doc))
    const start = Number(/startxref\n(\d+)/.exec(s)![1])
    expect(s.slice(start, start + 4)).toBe('xref')
    const entries = [...s.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]))
    entries.forEach((off, i) => expect(s.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true))
  })

  it('puts the watermark on every page and paginates long tables', () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`Account ${i}`, String(i)])
    const s = text(buildPdf({ ...doc, blocks: [{ type: 'table', columns: [{ title: 'Name', width: 300 }, { title: 'Value', width: 100, align: 'right' }], rows }] }))
    const pages = Number(/\/Count (\d+)/.exec(s)![1])
    expect(pages).toBeGreaterThan(1)
    expect(s.match(/\(SAMPLE\) Tj/g)!.length).toBe(pages)
    expect(s).toContain(`Page ${pages} of ${pages}`)
  })

  it('escapes parentheses and maps non-ASCII safely', () => {
    expect(ascii('−5 · ok’s')).toBe("-5 | ok's")
    const s = text(buildPdf({ ...doc, blocks: [{ type: 'p', text: 'Total (sample) \\ ok' }] }))
    expect(s).toContain('Total \\(sample\\) \\\\ ok')
  })
})
