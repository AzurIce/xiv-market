import { createMemo, createSignal, For, Show, onMount, onCleanup } from 'solid-js'
import { formatGil, formatAxisGil } from './format'

// 价格分布的迷你区间条：P25~P75 色带 + P50 中线 + 最低挂单圆点。
// 双条对比时由父级传入共享 domain，保证两条坐标对齐；单条时各自自适应。
export function PriceRangeStrip(props: {
  min?: number
  p25: number
  p50: number
  p75: number
  domain?: { lo: number; hi: number }
}) {
  const domain = createMemo(() => {
    if (props.domain) return props.domain
    const lo = Math.min(props.min ?? props.p25, props.p25)
    const hi = props.p75
    const span = hi - lo
    const pad = span > 0 ? span * 0.25 : Math.max(hi * 0.1, 1)
    return { lo: lo - pad, hi: hi + pad }
  })
  const pct = (v: number) =>
    Math.min(100, Math.max(0, ((v - domain().lo) / (domain().hi - domain().lo)) * 100))

  // 标签避让在像素空间进行：百分比阈值在窄条（移动端）下不足以容纳文字会相撞，
  // 在宽条下又会把标签无谓地钉到边缘。量出容器实际宽度后做最小位移去重叠
  let rootRef!: HTMLDivElement
  const [stripWidth, setStripWidth] = createSignal(0)
  onMount(() => {
    const observer = new ResizeObserver((entries) => setStripWidth(entries[0].contentRect.width))
    observer.observe(rootRef)
    onCleanup(() => observer.disconnect())
  })

  // 估算标签像素宽度：标签/数值两行取宽者；CJK ≈ 1em，其余 ≈ 0.6em，外加 4px 余量
  const estimateWidth = (label: string, value: string) => {
    const line = (s: string, fontSize: number) => {
      let w = 0
      for (const ch of s) w += (ch.codePointAt(0) ?? 0) > 0x2e7f ? fontSize : fontSize * 0.6
      return w
    }
    return Math.ceil(Math.max(line(label, 9), line(value, 10))) + 4
  }

  const px = (v: number) => (pct(v) / 100) * stripWidth()
  const clampCenter = (center: number, w: number) => {
    if (stripWidth() <= w) return stripWidth() / 2
    return Math.min(Math.max(center, w / 2), stripWidth() - w / 2)
  }
  // 左右相邻两标签（a 恒在 b 左侧）去重叠：优先各自贴合理想位置，
  // 间距不足时绕中点向两侧推开，再整体收进容器
  const placePair = (a: { x: number; w: number }, b: { x: number; w: number }, gap = 6): [number, number] => {
    const need = (a.w + b.w) / 2 + gap
    let ca = clampCenter(a.x, a.w)
    let cb = clampCenter(b.x, b.w)
    if (cb - ca < need) {
      const mid = (ca + cb) / 2
      const shift =
        Math.max(0, a.w / 2 - (mid - need / 2)) - Math.max(0, mid + need / 2 + b.w / 2 - stripWidth())
      ca = clampCenter(mid - need / 2 + shift, a.w)
      cb = clampCenter(mid + need / 2 + shift, b.w)
    }
    return [ca, cb]
  }

  type StripLabel = {
    label: string
    value: string
    center: number
    idealPct: number
    labelClass: string
    valueClass: string
  }

  // 顶部标签：最低挂单 + P50。最低恒在 P50 左侧（最低价 ≤ 中位价），
  // 距离过近时向两侧推开——只移位、不省略
  const topLabels = createMemo((): StripLabel[] => {
    const p50 = {
      label: 'P50',
      value: formatAxisGil(props.p50),
      idealPct: pct(props.p50),
      labelClass: 'text-[9px] text-amber-500',
      valueClass: 'text-[10px] font-semibold text-amber-500',
    }
    if (props.min == null || props.min <= 0) {
      return [{ ...p50, center: clampCenter(px(props.p50), estimateWidth(p50.label, p50.value)) }]
    }
    const min = {
      label: '最低',
      value: formatAxisGil(props.min),
      idealPct: pct(props.min),
      labelClass: 'text-[9px] text-muted-foreground',
      valueClass: 'text-[10px] font-semibold text-foreground',
    }
    const [cm, cp] = placePair(
      { x: px(props.min), w: estimateWidth(min.label, min.value) },
      { x: px(props.p50), w: estimateWidth(p50.label, p50.value) },
    )
    // min 后渲染，极端窄条放不下两个标签时盖住 P50（最低价更重要）
    return [
      { ...p50, center: cp },
      { ...min, center: cm },
    ]
  })

  // 底部标签：P25、P75。理想位置放得下就各自标注在色带两端；放不下则合并为
  // 一个居中标签——P25 与 P75 相等时标明 P25=P75，避免单个数字看起来像漏渲染
  const bottomLabels = createMemo((): StripLabel[] => {
    const tickClass = {
      labelClass: 'text-[9px] text-muted-foreground',
      valueClass: 'text-[10px] text-muted-foreground',
    }
    const p25v = formatAxisGil(props.p25)
    const p75v = formatAxisGil(props.p75)
    const x25 = px(props.p25)
    const x75 = px(props.p75)
    // 未测量到宽度时的首帧兜底：沿用 10% 阈值
    const fits =
      stripWidth() > 0
        ? x75 - x25 >= (estimateWidth('P25', p25v) + estimateWidth('P75', p75v)) / 2 + 6
        : Math.abs(pct(props.p75) - pct(props.p25)) >= 10
    if (fits) {
      const [c25, c75] = placePair(
        { x: x25, w: estimateWidth('P25', p25v) },
        { x: x75, w: estimateWidth('P75', p75v) },
      )
      return [
        { label: 'P25', value: p25v, center: c25, idealPct: pct(props.p25), ...tickClass },
        { label: 'P75', value: p75v, center: c75, idealPct: pct(props.p75), ...tickClass },
      ]
    }
    const equal = props.p25 === props.p75
    const label = equal ? 'P25=P75' : 'P25~P75'
    const value = equal ? p25v : `${p25v}~${p75v}`
    const idealPct = (pct(props.p25) + pct(props.p75)) / 2
    return [
      { label, value, center: clampCenter((x25 + x75) / 2, estimateWidth(label, value)), idealPct, ...tickClass },
    ]
  })

  // 未测量到宽度时的首帧兜底：按理想百分比 + 边缘锚定落位
  const labelStyle = (l: StripLabel) =>
    stripWidth() > 0
      ? { left: `${l.center}px`, transform: 'translateX(-50%)' }
      : {
          left: `${l.idealPct}%`,
          transform:
            l.idealPct <= 4 ? 'translateX(0)' : l.idealPct >= 96 ? 'translateX(-100%)' : 'translateX(-50%)',
        }

  return (
    <div ref={rootRef}>
      {/* P50 与最低挂单的标签放在条的上方，避免与下方 P25/P75 标签重叠 */}
      <div class="relative mb-1.5 h-6">
        <For each={topLabels()}>
          {(l) => (
            <span
              class="absolute top-0 flex flex-col items-center gap-0.5 whitespace-nowrap leading-none tabular-nums"
              style={labelStyle(l)}
            >
              <span class={l.labelClass}>{l.label}</span>
              <span class={l.valueClass}>{l.value}</span>
            </span>
          )}
        </For>
      </div>
      <div class="relative h-1.5 rounded-full bg-muted">
        {/* P25=P75 时区间退化为一个点，渲染成细线而非假装有宽度 */}
        <div
          class="absolute inset-y-0 rounded-full bg-primary/30"
          style={
            props.p25 === props.p75
              ? { left: `calc(${pct(props.p25)}% - 1px)`, width: '2px' }
              : {
                  left: `${pct(props.p25)}%`,
                  width: `${Math.max(pct(props.p75) - pct(props.p25), 2)}%`,
                }
          }
        />
        <div
          class="absolute -inset-y-[3px] w-0.5 rounded-full bg-amber-500"
          style={{ left: `calc(${pct(props.p50)}% - 1px)` }}
        />
        <Show when={props.min != null && props.min > 0}>
          <div
            class="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
            style={{ left: `${pct(props.min!)}%` }}
            title={`最低挂单 ${formatGil(props.min!)} Gil`}
          />
        </Show>
      </div>
      <div class="relative mt-1.5 h-6">
        <For each={bottomLabels()}>
          {(l) => (
            <span
              class="absolute top-0 flex flex-col items-center gap-0.5 whitespace-nowrap leading-none tabular-nums"
              style={labelStyle(l)}
            >
              <span class={l.labelClass}>{l.label}</span>
              <span class={l.valueClass}>{l.value}</span>
            </span>
          )}
        </For>
      </div>
    </div>
  )
}
