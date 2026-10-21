import { Tooltip as T } from 'radix-ui'
import type { ReactNode } from 'react'

export const TooltipProvider = T.Provider

export function Tooltip({ content, children, side = 'right', disabled }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; disabled?: boolean }) {
  if (disabled) return <>{children}</>
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} className="z-50 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text shadow-lg">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
