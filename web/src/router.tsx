import { createHashHistory, createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Shell } from '@/components/shell/Shell'
import { navItem } from '@/components/shell/nav'
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives'
import { useSession } from '@/session'
import { SocPage } from '@/pages/engagement/Soc'
import { InboxPage } from '@/pages/engagement/Inbox'
import { ListeningPage } from '@/pages/engagement/Listening'
import { PendingSection } from '@/pages/PendingSection'
import { ChannelsPage } from '@/pages/channels/Channels'
import { AssetGroupsPage } from '@/pages/channels/AssetGroups'
import { ContentPage } from '@/pages/content/Content'
import { ComposerPage } from '@/pages/content/Composer'
import { CalendarPage } from '@/pages/content/Calendar'
import { MediaPage } from '@/pages/media/Media'

export interface PageSearch {
  c?: string
  topic?: string
  q?: string
  sentiment?: string
  network?: string
  group?: string
  tab?: string
  batch?: string
  status?: string
}

const rootRoute = createRootRoute({ component: Shell })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <Navigate to="/$page" params={{ page: 'soc' }} /> })

const pageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$page',
  validateSearch: (search: Record<string, unknown>): PageSearch => {
    const pick = (k: string) => (typeof search[k] === 'string' && search[k] ? (search[k] as string) : undefined)
    return { c: pick('c'), topic: pick('topic'), q: pick('q'), sentiment: pick('sentiment'), network: pick('network'), group: pick('group'), tab: pick('tab'), batch: pick('batch'), status: pick('status') }
  },
  component: PageSwitch,
})

function PageSwitch() {
  const { page } = pageRoute.useParams()
  const session = useSession()
  if (page === 'composer') {
    if (!session.data) return <Skeleton className="h-96" />
    return session.data.functions['content.create'] ? <ComposerPage /> : <EmptyState title="Your demo user does not have this function" icon={<Lock />}>Creating posts needs the content creation function.</EmptyState>
  }
  const item = navItem(page)
  if (!item) return <Navigate to="/$page" params={{ page: 'soc' }} />
  if (!session.data) return <Skeleton className="h-96" />
  if (!item.allowed(session.data)) {
    return (
      <>
        <PageHeader title={item.title} />
        <EmptyState title="Your demo user does not have this function" icon={<Lock />}>
          An administrator grants functions and account access separately in Users & Access. Switch "View as" to another user to compare.
        </EmptyState>
      </>
    )
  }
  if (!item.built) return <PendingSection item={item} />
  if (page === 'soc') return <SocPage />
  if (page === 'inbox') return <InboxPage />
  if (page === 'listening') return <ListeningPage />
  if (page === 'channels') return <ChannelsPage />
  if (page === 'assets') return <AssetGroupsPage />
  if (page === 'content') return <ContentPage />
  if (page === 'calendar') return <CalendarPage />
  if (page === 'media') return <MediaPage />
  return <PendingSection item={item} />
}

export const pageRouteApi = pageRoute

const routeTree = rootRoute.addChildren([indexRoute, pageRoute])

export const router = createRouter({ routeTree, history: createHashHistory(), defaultPreload: false })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
