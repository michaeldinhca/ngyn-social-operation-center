import type { Network, SocialAccount } from '@/domain/types'
import { cn } from '@/lib/utils'
import { SAMPLE_PHOTOS } from '@/mock/photos'
import { Badge } from '@/components/ui/primitives'

const NETWORK_STYLE: Record<Network, { bg: string; glyph: string }> = {
  Facebook: { bg: '#1877f2', glyph: 'f' },
  Instagram: { bg: '#d62976', glyph: 'IG' },
  Bluesky: { bg: '#1185fe', glyph: 'bs' },
  LinkedIn: { bg: '#0a66c2', glyph: 'in' },
  YouTube: { bg: '#e62117', glyph: '▶' },
  X: { bg: '#0f1419', glyph: 'X' },
}

export function NetworkMark({ network, className }: { network: Network; className?: string }) {
  const s = NETWORK_STYLE[network]
  return (
    <span
      className={cn('inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white ring-2 ring-surface', className)}
      style={{ background: s.bg }}
      aria-label={network}
      role="img"
    >
      {s.glyph}
    </span>
  )
}

const DEPT_COLOR: Record<string, string> = {
  Communications: '#d0fc70',
  'Public Works': '#a4b8da',
  Transit: '#9fcabf',
  Recreation: '#d5ba8e',
  'Customer Service': '#b7a3d4',
  IT: '#c4ccaa',
}

const DEPT_INITIALS: Record<string, string> = {
  Communications: 'CM',
  'Public Works': 'PW',
  Transit: 'TR',
  Recreation: 'RC',
  'Customer Service': 'CS',
  IT: 'IT',
}

export function ChannelAvatar({ account, size = 40 }: { account: SocialAccount; size?: number }) {
  const initials = DEPT_INITIALS[account.department]
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className="flex size-full items-center justify-center rounded-full font-bold text-[#151813]" style={{ fontSize: Math.round(size * 0.3), background: DEPT_COLOR[account.department] }} aria-hidden>
        {initials}
      </span>
      <NetworkMark network={account.network} className={cn('absolute -bottom-0.5 -right-0.5', size < 36 && 'size-[14px] text-[7px]')} />
    </span>
  )
}

export function ConnectionBadge({ status }: { status: SocialAccount['connection']['status'] }) {
  const tone = status === 'Healthy' ? 'good' : status === 'Expiring' ? 'warn' : 'bad'
  return <Badge tone={tone}>{status === 'Healthy' ? 'Connected' : status === 'Expiring' ? 'Expiring soon' : status === 'Expired' ? 'Token expired' : 'Error'}</Badge>
}

export function PhotoCredit({ index }: { index: number }) {
  const p = SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length]
  return (
    <p className="text-xs text-muted">
      Sample photo:{' '}
      <a className="underline underline-offset-2 hover:text-text" href={p.source} target="_blank" rel="noreferrer">
        {p.author} on Unsplash
      </a>
      . Illustrative location, not Harbourview.
    </p>
  )
}
