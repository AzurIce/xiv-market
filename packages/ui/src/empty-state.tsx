import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'

import { cn } from '@xiv-market/shared'

export function EmptyState(props: {
  icon?: JSX.Element
  title: string
  description?: string
  action?: JSX.Element
  class?: string
}) {
  const [, rest] = splitProps(props, ['class'])

  return (
    <div
      class={cn(
        'flex flex-col items-center justify-center py-12 px-4',
        props.class,
      )}
      {...rest}
      role="status"
      aria-live="polite"
    >
      {props.icon && (
        <div class="mb-4 text-muted-foreground">{props.icon}</div>
      )}
      <h3 class="text-xl font-semibold text-foreground">{props.title}</h3>
      {props.description && (
        <p class="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          {props.description}
        </p>
      )}
      {props.action && <div class="mt-4">{props.action}</div>}
    </div>
  )
}
