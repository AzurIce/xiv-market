import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'

import { cn } from '@xiv-market/shared'
import { Card, CardContent, CardHeader, CardTitle } from './card'

export function StatCard(props: {
  title: string
  icon?: JSX.Element
  children: JSX.Element
  class?: string
}) {
  const [, rest] = splitProps(props, ['class'])

  return (
    <Card class={cn(props.class)} {...rest}>
      <CardHeader class="pb-2">
        <div class="flex items-center justify-between">
          <CardTitle class="text-sm font-medium text-muted-foreground">
            {props.title}
          </CardTitle>
          {props.icon && (
            <span class="text-muted-foreground">{props.icon}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  )
}
