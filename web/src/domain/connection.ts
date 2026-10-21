import type { SocialAccount } from './types'

const DAY = 864e5

/** Simulated connection health derived from the token expiry date. */
export function connectionStatus(a: SocialAccount): SocialAccount['connection']['status'] {
  if (a.connection.status === 'Error') return 'Error'
  const left = new Date(a.connection.expiresAt).getTime() - Date.now()
  if (left <= 0) return 'Expired'
  if (left < 7 * DAY) return 'Expiring'
  return 'Healthy'
}
