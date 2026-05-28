import { Show, createSignal, createEffect, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'

import { cn } from '@xiv-market/shared'

export function useIsMobile() {
  const [isMobile, setIsMobile] = createSignal(false)

  createEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  })

  return isMobile
}

export function ResponsiveView(props: {
  desktop: JSX.Element
  mobile: JSX.Element
  class?: string
}) {
  const [, rest] = splitProps(props, ['class'])
  const isMobile = useIsMobile()

  return (
    <div class={cn('w-full', props.class)} {...rest}>
      <Show when={!isMobile()} fallback={props.mobile}>
        {props.desktop}
      </Show>
    </div>
  )
}
