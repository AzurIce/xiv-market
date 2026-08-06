import { createEffect, createSignal, on, Show } from 'solid-js'

import { cn, getItemIconUrl } from '@xiv-market/shared'

/**
 * 物品图标：按顺序尝试多个图源（xivapi → garlandtools），
 * 全部失败或物品无图标时渲染同尺寸占位块，不再裂图。
 */
export function ItemIcon(props: { itemId: number; class?: string }) {
  const urls = () => getItemIconUrl(props.itemId)
  const [idx, setIdx] = createSignal(0)
  createEffect(on(() => props.itemId, () => setIdx(0)))

  return (
    <Show
      when={idx() < urls().length}
      fallback={<div class={cn('rounded bg-muted', props.class)} aria-hidden="true" />}
    >
      <img
        src={urls()[idx()]}
        alt=""
        loading="lazy"
        draggable="false"
        class={props.class}
        onError={() => setIdx((i) => i + 1)}
      />
    </Show>
  )
}
