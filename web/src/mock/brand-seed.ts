import type { BrandLogo, BrandPackage, Department, GuidelineSet } from '@/domain/types'

// Fictional brand marks drawn as SVG, so the demo ships no real logos.
function svg(markup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

export function wordmark(label: string, bg: string, fg: string, accent: string): string {
  return svg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120"><rect width="360" height="120" rx="14" fill="${bg}"/><path d="M34 82 54 38M52 82l20-44" stroke="${accent}" stroke-width="9" stroke-linecap="round"/><text x="92" y="58" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="30" font-weight="800" fill="${fg}">Harbourview</text><text x="93" y="86" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="16" font-weight="500" fill="${fg}" opacity=".8">${label}</text></svg>`,
  )
}

export function compactMark(bg: string, accent: string): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="26" fill="${bg}"/><path d="M38 86 58 34M60 86l20-52" stroke="${accent}" stroke-width="11" stroke-linecap="round"/></svg>`)
}

function logos(dept: Department, color: string): BrandLogo[] {
  const label = dept === 'Communications' ? 'Municipality' : dept
  return [
    { id: 'logo-primary', name: 'Primary', image: wordmark(label, '#151813', '#f4f5f0', color) },
    { id: 'logo-reversed', name: 'Reversed (light backgrounds)', image: wordmark(label, '#f4f5f0', '#151813', '#4f7a12') },
    { id: 'logo-mono', name: 'Monochrome', image: wordmark(label, '#ffffff', '#151813', '#151813') },
    { id: 'logo-compact', name: 'Compact mark', image: compactMark('#151813', color) },
  ]
}

const SETS: Record<Department, [string, string][]> = {
  Communications: [
    ['Service notices', 'Short, factual updates about municipal services: what changed, who is affected, when, and where to learn more.'],
    ['Council and engagement', 'Invite residents to take part in council decisions, surveys and public meetings. Lead with how to participate.'],
  ],
  'Public Works': [
    ['Road and water work', 'Closures, detours and repairs. Always include location, timing and an alternative route.'],
    ['Seasonal reminders', 'Leaf collection, winter parking, snow clearing. Friendly, practical, with exact dates.'],
  ],
  Transit: [
    ['Service changes', 'Detours and schedule changes, with accessible stop information in every post.'],
    ['Rider stories', 'Positive community stories about transit, featuring accessibility improvements.'],
  ],
  Recreation: [
    ['Programs and registration', 'Registration dates, fee assistance and how to sign up.'],
    ['Parks and trails', 'Inviting posts about parks and trails, with accessibility details.'],
  ],
  'Customer Service': [
    ['311 how-to', 'Explain how to request a service or find an answer, in plain language.'],
    ['Payment reminders', 'Due dates and ways to pay, without pressure or jargon.'],
  ],
  IT: [
    ['Digital services', 'Online services, outages and new features. Name the service and the workaround.'],
    ['Council livestreams', 'When and where to watch, with captions information.'],
  ],
}

export function defaultBrand(dept: Department, color: string, now: string, groupIndex: number): BrandPackage {
  const sets: GuidelineSet[] = SETS[dept].map(([name, purpose], i) => ({
    id: `set-${groupIndex}-${i}`,
    name,
    purpose,
    voice: '',
    voiceId: null,
    dos: i === 0 ? ['Lead with what changed and when.', 'Link to the official service page.'] : ['Show real community places (illustrative samples here).'],
    donts: i === 0 ? ['No speculation about causes or timelines.'] : ['No stock photos that look like a different city skyline as if it were Harbourview.'],
    visuals: [
      { id: `vis-${groupIndex}-${i}-0`, canvas: 'Square', width: 1080, height: 1080, photo: (groupIndex + i) % 5, note: 'Feed post' },
      { id: `vis-${groupIndex}-${i}-1`, canvas: 'Vertical', width: 1080, height: 1920, photo: (groupIndex + i + 2) % 5, note: 'Story / reel cover' },
    ],
    // One set per group is left unreviewed so the review state is visible in the demo.
    reviewed: i === 0 ? { by: 'Avery Morgan', at: now } : null,
  }))
  return {
    master: {
      name: dept === 'Communications' ? 'Municipality of Harbourview' : `Harbourview ${dept}`,
      logos: logos(dept, color),
      palette: groupIndex === 0 ? [color, '#151813', '#2a78d6'] : [color, '#151813'],
      headingFont: 'Inter Bold',
      bodyFont: 'Inter Regular',
      voice: dept === 'Communications' ? 'Clear, approachable, calm and inclusive. Use plain language.' : 'Helpful, practical and respectful. Explain services clearly.',
      mood: 'Calm, helpful and confident',
      tone: 'Plain language, respectful and inclusive',
      dos: ['Use verified service facts only.', 'Write ALT text for every image.', 'Include a clear next step and an official source.'],
      donts: ['Never disclose resident personal information.', 'Never invent service facts or emergency guidance.', 'Never publish without human approval.'],
      updatedAt: now,
      updatedBy: 'Avery Morgan',
    },
    sets,
    voices:
      groupIndex === 0
        ? [
            {
              id: 'voice-0',
              name: 'Harbourview community voice',
              method: 'description',
              source: 'A municipal government serving about 90,000 residents. We want to sound like a helpful neighbour who knows how the city works.',
              context: 'Residents of all ages; many read on phones; some use screen readers.',
              voice: 'Warm, direct and plain-spoken. Short sentences.',
              mood: 'Reassuring and capable',
              tone: 'Friendly but never casual about safety',
              audience: 'Residents, local businesses and visitors',
              reviewed: { by: 'Avery Morgan', at: now },
              createdAt: now,
            },
          ]
        : [],
  }
}
