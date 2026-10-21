import { Bookmark, Heart, MessageCircle, Play, Repeat2, Send, Share2, ThumbsUp } from 'lucide-react'
import { useBlobUrl } from '@/api/hooks'
import { ChannelAvatar } from '@/components/social'
import type { Network, PostFormat, SocialAccount } from '@/domain/types'
import { cn } from '@/lib/utils'
import { photoUrl } from '@/mock/photos'

export interface PreviewImage {
  photo: number | null
  blobId?: string | null
  mime?: string
}

/** Image for a post: an uploaded file from IndexedDB, or one of the credited sample photos. */
export function PostImage({ image, alt, className, width = 700, height }: { image: PreviewImage; alt: string; className?: string; width?: number; height?: number }) {
  const blob = useBlobUrl(image.blobId)
  const src = image.blobId ? blob : photoUrl(image.photo ?? 0, width, height)
  if (!src) return <div className={cn('animate-pulse bg-surface-3', className)} role="img" aria-label={alt} />
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className={cn('object-cover', className)} />
}

export interface PreviewProps {
  account: SocialAccount
  text: string
  comment?: string
  image: PreviewImage
  alt: string
  format: PostFormat
}

const when = 'Just now'

function Text({ text, className }: { text: string; className?: string }) {
  return <p className={cn('whitespace-pre-wrap break-words', className)}>{text || <span className="opacity-50">Your caption appears here.</span>}</p>
}

function Comment({ account, comment }: { account: SocialAccount; comment?: string }) {
  if (!comment) return null
  return (
    <div className="mt-3 rounded-lg bg-black/5 px-3 py-2 text-[0.8125rem] dark:bg-white/10">
      <span className="font-semibold">{account.name}</span> {comment}
      <span className="ml-1 text-[0.6875rem] opacity-60">Follow-up comment</span>
    </div>
  )
}

// Approximate native layouts. These are mock previews, not pixel-accurate platform renderings.
function Facebook({ account, text, comment, image, alt, format }: PreviewProps) {
  const vertical = format === 'Reel' || format === 'Story'
  return (
    <div className="rounded-xl bg-white p-3 text-[#050505] shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <ChannelAvatar account={account} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-semibold">{account.name}</p>
          <p className="text-[0.6875rem] text-[#65676b]">{when} · {format}</p>
        </div>
      </div>
      <Text text={text} className="mb-2 text-sm" />
      <PostImage image={image} alt={alt} className={cn('w-full rounded-md', vertical ? 'aspect-[9/16] max-h-80' : 'aspect-[1.91/1]')} />
      <div className="mt-2 flex justify-between border-t border-[#ced0d4] pt-2 text-xs text-[#65676b]">
        <span className="flex items-center gap-1"><ThumbsUp className="size-4" /> Like</span>
        <span className="flex items-center gap-1"><MessageCircle className="size-4" /> Comment</span>
        <span className="flex items-center gap-1"><Share2 className="size-4" /> Share</span>
      </div>
      <Comment account={account} comment={comment} />
    </div>
  )
}

function Instagram({ account, text, comment, image, alt, format }: PreviewProps) {
  const vertical = format === 'Reel' || format === 'Story'
  return (
    <div className="rounded-xl bg-white text-[#262626] shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <ChannelAvatar account={account} size={32} />
        <p className="truncate text-[0.8125rem] font-semibold">{account.handle.replace(/^@/, '')}</p>
        <span className="ml-auto text-[0.6875rem] text-[#8e8e8e]">{format}</span>
      </div>
      <PostImage image={image} alt={alt} className={cn('w-full', vertical ? 'aspect-[9/16] max-h-96' : 'aspect-square')} />
      <div className="flex items-center gap-3 px-3 pt-2.5">
        <Heart className="size-5" /> <MessageCircle className="size-5" /> <Send className="size-5" />
        <Bookmark className="ml-auto size-5" />
      </div>
      <div className="px-3 pb-3 pt-1.5 text-[0.8125rem]">
        <span className="font-semibold">{account.handle.replace(/^@/, '')}</span> <span className="whitespace-pre-wrap break-words">{text || <span className="opacity-50">Your caption appears here.</span>}</span>
        <Comment account={account} comment={comment} />
      </div>
    </div>
  )
}

function Bluesky({ account, text, comment, image, alt }: PreviewProps) {
  return (
    <div className="rounded-xl bg-white p-3 text-[#0b0f14] shadow-sm">
      <div className="flex gap-2.5">
        <ChannelAvatar account={account} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem]"><span className="font-semibold">{account.name}</span> <span className="text-[#667b99]">{account.handle} · now</span></p>
          <Text text={text} className="mt-1 text-sm" />
          <PostImage image={image} alt={alt} className="mt-2 aspect-[1.6/1] w-full rounded-lg border border-[#d4dbe2]" />
          <div className="mt-2 flex gap-6 text-[#667b99]"><MessageCircle className="size-4" /><Repeat2 className="size-4" /><Heart className="size-4" /><Share2 className="size-4" /></div>
          <Comment account={account} comment={comment} />
        </div>
      </div>
    </div>
  )
}

function LinkedIn({ account, text, comment, image, alt }: PreviewProps) {
  return (
    <div className="rounded-xl bg-white p-3 text-[#191919] shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <ChannelAvatar account={account} size={40} />
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-semibold">{account.name}</p>
          <p className="text-[0.6875rem] text-[#666]">Municipal organization · {when}</p>
        </div>
      </div>
      <Text text={text} className="mb-2 text-sm" />
      <PostImage image={image} alt={alt} className="aspect-[1.91/1] w-full rounded-md" />
      <div className="mt-2 flex justify-between border-t border-[#e0dfdc] pt-2 text-xs text-[#666]">
        <span>Like</span><span>Comment</span><span>Repost</span><span>Send</span>
      </div>
      <Comment account={account} comment={comment} />
    </div>
  )
}

function YouTube({ account, text, comment, image, alt }: PreviewProps) {
  return (
    <div className="mx-auto max-w-[15rem] overflow-hidden rounded-xl bg-black text-white shadow-sm">
      <div className="relative aspect-[9/16]">
        <PostImage image={image} alt={alt} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        <Play className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 fill-white/90 text-white/90" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-3 text-[0.8125rem] font-semibold">{text || 'Your title appears here.'}</p>
          <p className="mt-1 text-[0.6875rem] opacity-80">@{account.handle.replace(/^@/, '')} · Short</p>
        </div>
      </div>
      {comment && <div className="bg-[#212121] px-3 py-2 text-[0.75rem]"><span className="font-semibold">{account.name}</span> {comment}</div>}
    </div>
  )
}

function X({ account, text, comment, image, alt }: PreviewProps) {
  return (
    <div className="rounded-xl bg-white p-3 text-[#0f1419] shadow-sm">
      <div className="flex gap-2.5">
        <ChannelAvatar account={account} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem]"><span className="font-bold">{account.name}</span> <span className="text-[#536471]">{account.handle} · now</span></p>
          <Text text={text} className="mt-0.5 text-sm" />
          <PostImage image={image} alt={alt} className="mt-2 aspect-[1.78/1] w-full rounded-2xl border border-[#cfd9de]" />
          <div className="mt-2 flex gap-8 text-[#536471]"><MessageCircle className="size-4" /><Repeat2 className="size-4" /><Heart className="size-4" /><Share2 className="size-4" /></div>
          <Comment account={account} comment={comment} />
        </div>
      </div>
    </div>
  )
}

const BY_NETWORK: Record<Network, (p: PreviewProps) => React.ReactElement> = { Facebook, Instagram, Bluesky, LinkedIn, YouTube, X }

export function PostPreview(props: PreviewProps) {
  const Layout = BY_NETWORK[props.account.network]
  return <Layout {...props} />
}
