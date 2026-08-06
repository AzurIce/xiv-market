import { splitProps } from 'solid-js'
import { cn } from '@xiv-market/shared'

// 单个骨架块不含 ARIA 标注（一屏十余个骨架会重复播报）；
// 由骨架容器统一 role="status" + sr-only 文本表达"加载中"
export function Skeleton(props: { class?: string }) {
  const [, rest] = splitProps(props, ['class'])

  return (
    <div class={cn('animate-pulse rounded-md bg-primary/10', props.class)} {...rest} aria-hidden="true" />
  )
}
