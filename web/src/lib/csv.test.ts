import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', 1]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",1\r\n')
  })
  it('leaves unavailable values empty, never zero', () => {
    expect(toCsv(['a', 'b'], [[null, 0]])).toBe('a,b\r\n,0\r\n')
  })
  it('neutralizes spreadsheet formulas in text but keeps negative numbers', () => {
    expect(toCsv(['a'], [['=SUM(A1)'], ['-5'], [-5]])).toBe("a\r\n'=SUM(A1)\r\n-5\r\n-5\r\n")
  })
})
