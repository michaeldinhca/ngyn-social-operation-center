import type { BrandVoice, GuidelineSet, MasterDirection } from './types'

// Brand direction rules (docs/handoff/CLAUDE_HANDOFF.md, "Brand & direction"):
// - One master per Asset Group; its DO/DON'T rules are mandatory and come first.
// - Palette is exactly two or three hex colours.
// - A guideline set is complete with a name, written purpose and at least one visual.
// - Changing master rules forces every set and voice back to review.

const HEX = /^#[0-9a-fA-F]{6}$/

export function validPalette(palette: string[]): boolean {
  return palette.length >= 2 && palette.length <= 3 && palette.every((c) => HEX.test(c))
}

export function packageProblems(set: GuidelineSet): string[] {
  const problems: string[] = []
  if (!set.name.trim()) problems.push('Add a name.')
  if (!set.purpose.trim()) problems.push('Write the purpose and direction.')
  if (!set.visuals.length) problems.push('Add at least one visual reference.')
  return problems
}

export function isCompletePackage(set: GuidelineSet): boolean {
  return packageProblems(set).length === 0
}

/** Lines that the new master direction changed, for the re-review notice. */
export function masterChanged(before: MasterDirection, after: MasterDirection): boolean {
  const pick = (m: MasterDirection) => JSON.stringify([m.name, m.logos.map((l) => [l.id, l.name]), m.palette, m.headingFont, m.bodyFont, m.voice, m.mood, m.tone, m.dos, m.donts])
  return pick(before) !== pick(after)
}

export interface CompiledBrief {
  mode: 'Local preview. No AI call is made.'
  precedence: string[]
  master: { name: string; voice: string; mood: string; tone: string; mandatoryDos: string[]; mandatoryDonts: string[]; palette: string[]; typography: string[]; logos: string[] }
  guideline: { name: string; purpose: string; voice: string; additionalDos: string[]; additionalDonts: string[] }
  voiceProfile: { name: string; voice: string; mood: string; tone: string; audience: string } | null
  visualReferences: { canvas: string; size: string; note: string; status: string }[]
  humanReviewRequired: true
  externalPublishing: false
}

/** Master rules always come before guideline additions; a guideline can add, never override. */
export function compileBrief(master: MasterDirection, set: GuidelineSet, voice: BrandVoice | null): CompiledBrief {
  return {
    mode: 'Local preview. No AI call is made.',
    precedence: ['1. Master guardrails (mandatory)', '2. Guideline additions (cannot override the master)', '3. Voice profile (style only)'],
    master: {
      name: master.name,
      voice: master.voice,
      mood: master.mood,
      tone: master.tone,
      mandatoryDos: master.dos,
      mandatoryDonts: master.donts,
      palette: master.palette,
      typography: [master.headingFont, master.bodyFont],
      logos: master.logos.map((l) => l.name),
    },
    guideline: { name: set.name, purpose: set.purpose, voice: set.voice, additionalDos: set.dos, additionalDonts: set.donts },
    voiceProfile: voice ? { name: voice.name, voice: voice.voice, mood: voice.mood, tone: voice.tone, audience: voice.audience } : null,
    visualReferences: set.visuals.map((v) => ({ canvas: v.canvas, size: `${v.width}×${v.height}`, note: v.note, status: 'Sample working canvas; platform requirements unverified' })),
    humanReviewRequired: true,
    externalPublishing: false,
  }
}

/** Mock Brand Voice draft. Website mode validates the URL but never fetches it. */
export function draftVoice(method: 'website' | 'description', source: string, context: string) {
  const hint = (method === 'description' ? source : context).toLowerCase()
  const emergency = /emergenc|safety|storm|flood/.test(hint)
  const youth = /youth|student|young|teen/.test(hint)
  return {
    voice: emergency ? 'Calm, direct and precise. Short sentences; lead with the action to take.' : 'Clear, approachable and respectful. Explain services in plain language.',
    mood: emergency ? 'Steady and reassuring' : 'Helpful and confident',
    tone: youth ? 'Friendly and upbeat, never condescending' : 'Inclusive and practical',
    audience: youth ? 'Young residents and students' : 'Residents and community members',
  }
}

export function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
