import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'

import { cn } from '@xiv-market/shared'

export function PageHeader(props: {
  title: string
  description?: string
  actions?: JSX.Element
  class?: string
}) {
  const [, rest] = splitProps(props, ['class'])

  return (
    <div class={cn('mb-8', props.class)} {...rest}>
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">{props.title}</h1>
          {props.description && (
            <p class="text-muted-foreground mt-1">{props.description}</p>
          )}
        </div>
        {props.actions && <div class="shrink-0">{props.actions}</div>}
      </div>
    </div>
  )
}
