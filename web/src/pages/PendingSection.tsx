import { Hammer } from 'lucide-react'
import type { NavItem } from '@/components/shell/nav'
import { EmptyState, PageHeader } from '@/components/ui/primitives'

/** Screens that belong to a later review section of the rebuild. */
export function PendingSection({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader eyebrow="Rebuild in progress" title={item.title} />
      <EmptyState title="Not rebuilt yet" icon={<Hammer />}>
        This screen comes in a later review section. The previous prototype (v0) still has its earlier version.
      </EmptyState>
    </>
  )
}
