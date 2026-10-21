import type { Network, PostFormat } from '@/domain/types'

// Planning values for the composer. Not verified against platform documentation:
// character limits and supported formats must be confirmed per platform before production.
export const NETWORK_LIMITS: Record<Network, number> = {
  Facebook: 5000,
  Instagram: 2200,
  Bluesky: 300,
  LinkedIn: 3000,
  YouTube: 5000,
  X: 280,
}

export const NETWORK_FORMATS: Record<Network, PostFormat[]> = {
  Facebook: ['Feed', 'Reel', 'Story'],
  Instagram: ['Feed', 'Reel', 'Story'],
  Bluesky: ['Feed'],
  LinkedIn: ['Feed'],
  YouTube: ['Short'],
  X: ['Feed', 'Thread'],
}

export const FORMAT_HELP: Record<PostFormat, string> = {
  Feed: 'Standard post in the feed',
  Reel: 'Short vertical video (video upload not built yet)',
  Story: 'Full-screen vertical, 24 hours',
  Short: 'Short vertical video (video upload not built yet)',
  Thread: 'Connected series of posts',
}
