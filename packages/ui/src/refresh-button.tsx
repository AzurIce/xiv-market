import { splitProps } from 'solid-js'

import { cn } from '@xiv-market/shared'

import { Button } from './button'

export function RefreshButton(props: {
  loading?: boolean
  onClick: () => void
  class?: string
}) {
  const [, rest] = splitProps(props, ['class', 'loading', 'onClick'])

  return (
    <Button
      variant="outline"
      size="icon"
      class={cn('size-8', props.class)}
      disabled={props.loading}
      onClick={() => props.onClick()}
      aria-label="刷新数据"
      title="刷新数据"
      {...rest}
    >
      <svg
        class={cn('size-4', props.loading && 'animate-spin')}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </Button>
  )
}
