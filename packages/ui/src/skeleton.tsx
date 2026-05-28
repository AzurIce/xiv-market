import { splitProps } from 'solid-js'
import { cn } from '@xiv-market/shared'

export function Skeleton(props: { class?: string }) {
  const [, rest] = splitProps(props, ['class'])

  return (
    <div class={cn('animate-pulse rounded-md bg-primary/10', props.class)} {...rest} />
  )
}
