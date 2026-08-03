import { splitProps } from 'solid-js'
import { Badge as BadgePrimitive } from '@kobalte/core/badge'

import { cn } from '@xiv-market/shared'
import { badgeVariants } from './badge'

// 品质徽章：HQ 用琥珀黄（游戏内 HQ 的金色意象），NQ 用 secondary 灰。
// 全站所有 NQ/HQ 标识统一使用此组件。
// 注意：必须经 cn() 合并 badgeVariants 的输出——直接给 Badge 传覆盖 class 时
// cva 只做 clsx 拼接、不消解冲突，variant 自带的颜色类会和覆盖类共存，胜负取决于 CSS 顺序。
export function QualityBadge(props: { hq: boolean; class?: string }) {
  const [, rest] = splitProps(props, ['class'])

  return (
    <BadgePrimitive
      class={cn(
        badgeVariants({ variant: props.hq ? 'default' : 'secondary' }),
        props.hq && 'border-amber-200 bg-amber-100 font-semibold text-amber-800',
        props.class,
      )}
      {...rest}
    >
      {props.hq ? 'HQ' : 'NQ'}
    </BadgePrimitive>
  )
}
