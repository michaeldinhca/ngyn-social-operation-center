import { describe, expect, it } from 'vitest'
import { compileBrief, draftVoice, isCompletePackage, masterChanged, validHttpsUrl, validPalette } from './brand'
import type { GuidelineSet, MasterDirection } from './types'

const master: MasterDirection = {
  name: 'M',
  logos: [{ id: 'l', name: 'Primary', image: '' }],
  palette: ['#d0fc70', '#151813'],
  headingFont: 'Inter Bold',
  bodyFont: 'Inter',
  voice: 'Plain',
  mood: 'Calm',
  tone: 'Kind',
  dos: ['Use verified facts'],
  donts: ['No personal data'],
  updatedAt: '',
  updatedBy: '',
}

const set: GuidelineSet = { id: 's', name: 'Notices', purpose: 'Service updates', voice: '', voiceId: null, dos: ['Next steps'], donts: ['Jargon'], visuals: [{ id: 'v', canvas: 'Square', width: 1080, height: 1080, photo: 0, note: '' }], reviewed: null }

describe('brand rules', () => {
  it('palette needs two or three valid hex colours', () => {
    expect(validPalette(['#000000'])).toBe(false)
    expect(validPalette(['#000000', '#ffffff'])).toBe(true)
    expect(validPalette(['#000000', '#ffffff', '#123456', '#abcdef'])).toBe(false)
    expect(validPalette(['#000000', 'white'])).toBe(false)
  })

  it('a package needs a name, purpose and at least one visual', () => {
    expect(isCompletePackage(set)).toBe(true)
    expect(isCompletePackage({ ...set, visuals: [] })).toBe(false)
    expect(isCompletePackage({ ...set, purpose: ' ' })).toBe(false)
  })

  it('compiled brief keeps master rules first and separate from additions', () => {
    const b = compileBrief(master, set, null)
    expect(b.precedence[0]).toMatch(/Master/)
    expect(b.master.mandatoryDonts).toEqual(['No personal data'])
    expect(b.guideline.additionalDonts).toEqual(['Jargon'])
    expect(b.externalPublishing).toBe(false)
    expect(b.humanReviewRequired).toBe(true)
  })

  it('detects master changes but ignores timestamps', () => {
    expect(masterChanged(master, { ...master, updatedAt: 'later' })).toBe(false)
    expect(masterChanged(master, { ...master, donts: [...master.donts, 'No jokes'] })).toBe(true)
  })

  it('website voice drafts require https and never fetch', () => {
    expect(validHttpsUrl('https://harbourview.example')).toBe(true)
    expect(validHttpsUrl('http://harbourview.example')).toBe(false)
    expect(validHttpsUrl('not a url')).toBe(false)
    expect(draftVoice('description', 'storm and flood alerts', '').mood).toBe('Steady and reassuring')
  })
})
