import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Network } from '@/domain/types'
import * as api from '@/mock/api'
import * as ads from '@/mock/api-ads'
import * as analytics from '@/mock/api-analytics'
import * as assets from '@/mock/api-assets'
import * as users from '@/mock/api-users'
import * as content from '@/mock/api-content'
import * as media from '@/mock/api-media'
import { getBlob } from '@/mock/blobs'
import { useSessionContext } from '@/session'

// Query layer. Screens talk to these hooks only; swapping the mock adapter for an HTTP
// client later changes this file and src/mock, not the screens.

export function useActor() {
  return useSessionContext().actorId
}

/** Mutations refresh every query: simple and correct for a browser-local demo store. */
export function useAction<A extends unknown[], R>(fn: (actorId: string, ...args: A) => Promise<R>, opts?: { success?: string | ((r: R) => string) }) {
  const actorId = useActor()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: A) => fn(actorId, ...args),
    onSuccess: (r) => {
      qc.invalidateQueries()
      const msg = typeof opts?.success === 'function' ? opts.success(r) : opts?.success
      if (msg) toast.success(msg)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: api.listUsers })
}

export function useAccounts() {
  const actorId = useActor()
  return useQuery({ queryKey: ['accounts', actorId], queryFn: () => api.listAccounts(actorId) })
}

export function useSoc(network: Network | 'All', kind: 'All' | 'Comment' | 'Message') {
  const actorId = useActor()
  return useQuery({ queryKey: ['soc', actorId, network, kind], queryFn: () => api.socOverview(actorId, network, kind), placeholderData: (prev) => prev })
}

export function useConversations(filters: api.InboxFilters) {
  const actorId = useActor()
  return useQuery({ queryKey: ['conversations', actorId, filters], queryFn: () => api.listConversations(actorId, filters), placeholderData: (prev) => prev, retry: false })
}

export function useConversation(id: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['conversation', actorId, id], queryFn: () => api.getConversation(actorId, id!), enabled: !!id, retry: false })
}

export function useTopics() {
  const actorId = useActor()
  return useQuery({ queryKey: ['topics', actorId], queryFn: () => api.listTopics(actorId), retry: false })
}

export function useTopic(id: string | null, source: string) {
  const actorId = useActor()
  return useQuery({ queryKey: ['topic', actorId, id, source], queryFn: () => api.getTopic(actorId, id!, source), enabled: !!id, placeholderData: (prev) => prev, retry: false })
}

export function useChannels() {
  const actorId = useActor()
  return useQuery({ queryKey: ['channels', actorId], queryFn: () => assets.listChannels(actorId), retry: false })
}

export function useChannel(id: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['channel', actorId, id], queryFn: () => assets.getChannel(actorId, id!), enabled: !!id, retry: false })
}

export function useGroups() {
  const actorId = useActor()
  return useQuery({ queryKey: ['groups', actorId], queryFn: () => assets.listGroups(actorId), retry: false })
}

export function useGroup(id: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['group', actorId, id], queryFn: () => assets.getGroup(actorId, id!), enabled: !!id, retry: false, placeholderData: (prev) => (prev?.group.id === id ? prev : undefined) })
}

export function usePosts(filters: content.PostFilters) {
  const actorId = useActor()
  return useQuery({ queryKey: ['posts', actorId, filters], queryFn: () => content.listPosts(actorId, filters), placeholderData: (prev) => prev, retry: false })
}

export function usePost(id: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['post', actorId, id], queryFn: () => content.getPost(actorId, id!), enabled: !!id, retry: false })
}

export function useBatch(batchId: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['batch', actorId, batchId], queryFn: () => content.getBatch(actorId, batchId!), enabled: !!batchId, retry: false, staleTime: 0, gcTime: 0 })
}

export function useComposerContext() {
  const actorId = useActor()
  return useQuery({ queryKey: ['composer-context', actorId], queryFn: () => content.composerContext(actorId), retry: false })
}

export function useMediaList(filters: media.MediaFilters) {
  const actorId = useActor()
  return useQuery({ queryKey: ['media', actorId, filters], queryFn: () => media.listMedia(actorId, filters), placeholderData: (prev) => prev, retry: false })
}

export function useMediaItem(id: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['media-item', actorId, id], queryFn: () => media.getMedia(actorId, id!), enabled: !!id, retry: false })
}

export function useUsableMedia(enabled = true) {
  const actorId = useActor()
  return useQuery({ queryKey: ['media-usable', actorId], queryFn: () => media.listUsableMedia(actorId), enabled, retry: false })
}

/** Object URL for an uploaded file in IndexedDB. Revoked when the component unmounts. */
export function useBlobUrl(blobId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blobId) {
      setUrl(null)
      return
    }
    let revoked = false
    let made: string | null = null
    getBlob(blobId)
      .then((b) => {
        if (b && !revoked) {
          made = URL.createObjectURL(b)
          setUrl(made)
        }
      })
      .catch(() => setUrl(null))
    return () => {
      revoked = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [blobId])
  return url
}

export function useBrief(groupId: string, setId: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['brief', actorId, groupId, setId], queryFn: () => assets.briefPreview(actorId, groupId, setId!), enabled: !!setId, retry: false })
}

export function useAds() {
  const actorId = useActor()
  return useQuery({ queryKey: ['ads', actorId], queryFn: () => ads.adsOverview(actorId), retry: false })
}

export function useCampaign(id: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['campaign', actorId, id], queryFn: () => ads.getCampaign(actorId, id!), enabled: !!id && id !== 'new', retry: false })
}

export function useCampaignForm() {
  const actorId = useActor()
  return useQuery({ queryKey: ['campaign-form', actorId], queryFn: () => ads.campaignFormContext(actorId), retry: false })
}

export function useAnalytics(q: analytics.AnalyticsQuery) {
  const actorId = useActor()
  return useQuery({ queryKey: ['analytics', actorId, q], queryFn: () => analytics.getAnalytics(actorId, q), placeholderData: (prev) => prev, retry: false })
}

export function useStaff() {
  const actorId = useActor()
  return useQuery({ queryKey: ['staff', actorId], queryFn: () => users.listStaff(actorId), retry: false })
}

export function useStaffMember(id: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['staff-member', actorId, id], queryFn: () => users.getStaff(actorId, id!), enabled: !!id, retry: false })
}

export function useAudit(f: users.AuditFilters) {
  const actorId = useActor()
  return useQuery({ queryKey: ['audit', actorId, f], queryFn: () => users.listAudit(actorId, f), placeholderData: (prev) => prev, retry: false })
}
