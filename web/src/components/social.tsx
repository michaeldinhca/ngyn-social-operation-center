import type { Network, Post, SocialAccount } from '@/domain/types'
import { cn, formatDateTime, relativeTime, shortNumber } from '@/lib/utils'
import { photoUrl, SAMPLE_PHOTOS } from '@/mock/photos'
import { Dialog } from '@/components/ui/dialog'
import { Badge, SimBadge } from '@/components/ui/primitives'

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

/** Read-only post detail. Editing and approvals arrive with the Social Channels & Content section. */
export function PostDialog({ post, account, open, onOpenChange }: { post: Post | null; account: SocialAccount | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!post || !account) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={post.title} description={`${account.name} · ${account.network}`} className="max-w-xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={post.status === 'Published' ? 'good' : post.status === 'Failed' ? 'bad' : post.status === 'Scheduled' ? 'info' : 'neutral'}>{post.status}</Badge>
          {post.status === 'Scheduled' && <span className="text-sm text-text-2">Requested for {formatDateTime(post.scheduledFor)} (America/Halifax)</span>}
          {post.publishedAt && <span className="text-sm text-text-2">Attempted {relativeTime(post.publishedAt)}</span>}
        </div>
        <p className="text-[0.9375rem] leading-relaxed">{post.text}</p>
        <img src={photoUrl(post.photo, 900)} alt={post.alt} className="aspect-[1.91/1] w-full rounded-lg object-cover" loading="lazy" referrerPolicy="no-referrer" />
        <PhotoCredit index={post.photo} />
        {post.failureReason && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">Failure: {post.failureReason}. No platform was called.</p>}
        {post.metrics && (
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-border p-3 text-sm">
            <div>
              <p className="text-muted">Impressions</p>
              <p className="tabular font-semibold">{shortNumber(post.metrics.impressions)}</p>
            </div>
            <div>
              <p className="text-muted">Engagement</p>
              <p className="tabular font-semibold">{shortNumber(post.metrics.engagements)}</p>
            </div>
            <div>
              <p className="text-muted">Sample growth</p>
              <p className="tabular font-semibold">+{post.metrics.trend}%</p>
            </div>
            <div className="col-span-3">
              <SimBadge>Sample metrics</SimBadge>
            </div>
          </div>
        )}
        <p className="text-xs text-muted">Editing, approval and scheduling for this post open in All Content (next review section).</p>
      </div>
    </Dialog>
  )
}
