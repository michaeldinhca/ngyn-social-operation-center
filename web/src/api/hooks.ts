import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Network } from '@/domain/types'
import * as api from '@/mock/api'
import * as assets from '@/mock/api-assets'
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

export function useBrief(groupId: string, setId: string | null) {
  const actorId = useActor()
  return useQuery({ queryKey: ['brief', actorId, groupId, setId], queryFn: () => assets.briefPreview(actorId, groupId, setId!), enabled: !!setId, retry: false })
}
