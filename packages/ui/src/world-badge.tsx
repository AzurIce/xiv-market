import { createMemo, Show, splitProps } from 'solid-js'

import {
  cn,
  getDcNameByWorldName,
  getDcShortName,
  getWorldDcName,
  getWorldName,
} from '@xiv-market/shared'

// 中国四大区各一个区分色，其他大区用中性色。
// 色相与 shared 包 region.ts 的 DC_COLOR_HEX 保持一致（鸟=蓝、猫=橙黄、猪=紫、狗=绿），改色时两边同步。
const DC_BADGE_STYLES: Record<string, string> = {
  '陆行鸟': 'bg-blue-100 text-blue-800 border-blue-200',
  '猫小胖': 'bg-amber-100 text-amber-800 border-amber-200',
  '莫古力': 'bg-violet-100 text-violet-800 border-violet-200',
  '豆豆柴': 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export function DcBadge(props: { dcName: string; class?: string }) {
  const [, rest] = splitProps(props, ['class'])

  return (
    <span
      class={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] font-medium leading-none',
        DC_BADGE_STYLES[props.dcName] ?? 'bg-muted text-muted-foreground border-border',
        props.class,
      )}
      {...rest}
    >
      {getDcShortName(props.dcName)}
    </span>
  )
}

export function WorldBadge(props: {
  worldName?: string
  worldId?: number
  class?: string
}) {
  const [, rest] = splitProps(props, ['class'])

  const name = createMemo(() =>
    props.worldName || (props.worldId != null ? getWorldName(props.worldId) : null)
  )
  const dcName = createMemo(() => {
    if (props.worldName) return getDcNameByWorldName(props.worldName)
    if (props.worldId != null) return getWorldDcName(props.worldId)
    return null
  })
  const fallbackText = () => name() ?? (props.worldId != null ? `服务器 #${props.worldId}` : '-')

  // 大区/服务器映射未加载时降级为纯文本
  return (
    <Show
      when={name() && dcName()}
      fallback={<span class={props.class}>{fallbackText()}</span>}
    >
      <span
        class={cn('inline-flex items-center gap-1', props.class)}
        title={`${dcName()} · ${name()}`}
        {...rest}
      >
        <DcBadge dcName={dcName()!} />
        <span class="truncate">{name()}</span>
      </span>
    </Show>
  )
}
