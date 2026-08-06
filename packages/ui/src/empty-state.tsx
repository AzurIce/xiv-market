import { Show, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'

import { cn } from '@xiv-market/shared'

function ErrorIcon() {
  return (
    <svg
      class="size-8"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

// 空态家族：default = 成功但无数据；error = 加载失败（无内容时错误的落点）。
// 有内容时的错误走 toast，不用此组件
export function EmptyState(props: {
  icon?: JSX.Element
  title: string
  description?: string
  action?: JSX.Element
  variant?: 'default' | 'error'
  class?: string
}) {
  const [, rest] = splitProps(props, ['class', 'variant', 'icon', 'title', 'description', 'action'])
  const isError = () => props.variant === 'error'

  return (
    <div
      class={cn(
        'flex flex-col items-center justify-center py-12 px-4',
        props.class,
      )}
      {...rest}
      role={isError() ? 'alert' : 'status'}
      aria-live={isError() ? undefined : 'polite'}
    >
      <Show when={props.icon ?? (isError() ? <ErrorIcon /> : null)}>
        {(icon) => (
          <div class={cn('mb-4', isError() ? 'text-destructive' : 'text-muted-foreground')}>{icon()}</div>
        )}
      </Show>
      <h3 class={cn('text-xl font-semibold', isError() ? 'text-destructive' : 'text-foreground')}>{props.title}</h3>
      {props.description && (
        <p class="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          {props.description}
        </p>
      )}
      {props.action && <div class="mt-4">{props.action}</div>}
    </div>
  )
}
