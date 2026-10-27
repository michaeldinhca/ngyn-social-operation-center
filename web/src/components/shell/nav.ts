import {
  Activity,
  AudioLines,
  BarChart3,
  CalendarDays,
  FolderKanban,
  Image,
  Inbox,
  LayoutGrid,
  Link2,
  Megaphone,
  ScrollText,
  Settings2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { SessionInfo } from '@/mock/api'

export type PageId =
  | 'soc'
  | 'inbox'
  | 'listening'
  | 'channels'
  | 'content'
  | 'calendar'
  | 'media'
  | 'assets'
  | 'ads'
  | 'analytics'
  | 'users'
  | 'audit'
  | 'preferences'

export interface NavItem {
  id: PageId
  label: string
  title: string
  icon: LucideIcon
  /** Which review section this screen is built in. Screens from later sections show a placeholder. */
  built: boolean
  allowed: (s: SessionInfo) => boolean
}

const f = (s: SessionInfo) => s.functions

// Accepted menu grouping (docs/handoff/CLAUDE_HANDOFF.md). Do not reorder without a recorded decision.
export const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Engagement',
    items: [
      { id: 'soc', label: 'SOC', title: 'Social Operation Center', icon: Activity, built: true, allowed: () => true },
      { id: 'inbox', label: 'Inbox & Comments', title: 'Inbox & Comments', icon: Inbox, built: true, allowed: (s) => f(s)['inbox.respond'] },
      { id: 'listening', label: 'Social Listening', title: 'Social Listening', icon: AudioLines, built: true, allowed: (s) => f(s)['reports.view'] },
    ],
  },
  {
    title: 'Social Channels & Content',
    items: [
      { id: 'channels', label: 'Social Channels', title: 'Social Channels', icon: Link2, built: true, allowed: (s) => f(s)['channels.manage'] },
      { id: 'content', label: 'All Content', title: 'All Content', icon: LayoutGrid, built: true, allowed: (s) => f(s)['content.view'] || f(s)['content.create'] || f(s)['content.approve'] || f(s)['content.publish'] || f(s)['reports.view'] },
      { id: 'calendar', label: 'Publishing Calendar', title: 'Publishing Calendar', icon: CalendarDays, built: true, allowed: (s) => f(s)['content.view'] || f(s)['content.create'] || f(s)['content.publish'] },
      { id: 'media', label: 'Media Storage', title: 'Media Storage', icon: Image, built: true, allowed: (s) => s.isAdmin || f(s)['content.create'] || f(s)['content.approve'] || f(s)['content.publish'] },
      { id: 'assets', label: 'Asset Groups', title: 'Asset Groups', icon: FolderKanban, built: true, allowed: (s) => f(s)['assets.manage'] || f(s)['assets.delete'] },
    ],
  },
  {
    title: 'Advertising',
    items: [{ id: 'ads', label: 'Campaigns', title: 'Campaigns', icon: Megaphone, built: true, allowed: (s) => f(s)['ads.create'] || f(s)['ads.manage'] || f(s)['ads.accounts.add'] }],
  },
  {
    title: 'Insights',
    items: [{ id: 'analytics', label: 'Analytics & Reports', title: 'Analytics & Reports', icon: BarChart3, built: true, allowed: (s) => f(s)['reports.view'] }],
  },
  {
    title: 'Settings',
    items: [
      { id: 'users', label: 'Users & Access', title: 'Users & Access', icon: Users, built: true, allowed: (s) => s.isAdmin },
      { id: 'audit', label: 'Activity Log', title: 'Activity Log', icon: ScrollText, built: true, allowed: (s) => s.isAdmin },
      { id: 'preferences', label: 'My Preferences', title: 'My Preferences', icon: Settings2, built: true, allowed: () => true },
    ],
  },
]

export const NAV_ITEMS = NAV.flatMap((s) => s.items)
export const navItem = (id: string) => NAV_ITEMS.find((i) => i.id === id)
