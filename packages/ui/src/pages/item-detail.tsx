import { createResource, createMemo, createSignal, createEffect, Show, Suspense, For, on, onMount, onCleanup } from 'solid-js'
import { useParams, A, useSearchParams } from '@solidjs/router'
import { fetchMarketData, fetchHistoryData, selectedRegion, dataCenters, worlds, getItemName, getItemIconUrl, getDcNameByWorldName, getWorldName, getDcColorHex, baseUrl } from '@xiv-market/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../card'
import { QualityBadge } from '../quality-badge'
import { Skeleton } from '../skeleton'
import { Table, TableBody, TableRow, TableHead, TableCell, TableHeader } from '../table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'
import { EmptyState } from '../empty-state'
import { RefreshButton } from '../refresh-button'
import { ScopeSelect } from '../scope-select'
import { WorldBadge } from '../world-badge'
import { Tooltip, TooltipPortal, TooltipTrigger, TooltipContent } from '../tooltip'

type ChartConstructor = typeof import('chart.js/auto').default

let chartPromise: Promise<ChartConstructor> | null = null
let violinPluginPromise: Promise<void> | null = null

async function loadChart(registerViolin = false): Promise<ChartConstructor> {
  chartPromise ??= import('chart.js/auto').then((mod) => mod.default)
  const Chart = await chartPromise

  if (registerViolin) {
    violinPluginPromise ??= import('@sgratzl/chartjs-chart-boxplot').then((mod) => {
      Chart.register(mod.ViolinController, mod.Violin)
    })
    await violinPluginPromise
  }

  return Chart
}

const CHINA_DC_NAMES = ['陆行鸟', '莫古力', '猫小胖', '豆豆柴'] as const

const FALLBACK_DC_COLOR = { solid: '#9ca3af', bg: '#9ca3af80', point: '#9ca3af80' }
const SERVER_COLORS = [
  { solid: '#38bdf8', bg: '#38bdf880', point: '#38bdf880' },
  { solid: '#fb7185', bg: '#fb718580', point: '#fb718580' },
  { solid: '#4ade80', bg: '#4ade8080', point: '#4ade8080' },
  { solid: '#fbbf24', bg: '#fbbf2480', point: '#fbbf2480' },
  { solid: '#a78bfa', bg: '#a78bfa80', point: '#a78bfa80' },
  { solid: '#f472b6', bg: '#f472b680', point: '#f472b680' },
  { solid: '#2dd4bf', bg: '#2dd4bf80', point: '#2dd4bf80' },
  { solid: '#94a3b8', bg: '#94a3b880', point: '#94a3b880' },
]

function getDcColor(dc: string | null | undefined) {
  const hex = dc ? getDcColorHex(dc) : null
  if (hex) return { solid: hex, bg: `${hex}80`, point: `${hex}80` }
  return FALLBACK_DC_COLOR
}

type ScopeKind = 'region' | 'dc' | 'world'

function getScopeKind(scope: string): ScopeKind {
  if (dataCenters.some((dc) => dc.region === scope)) return 'region'
  if (dataCenters.some((dc) => dc.name === scope)) return 'dc'
  return 'world'
}

function getWorldNamesInDc(dcName: string): string[] {
  const dc = dataCenters.find((d) => d.name === dcName)
  if (!dc) return []
  return dc.worlds
    .map((worldId) => getWorldName(worldId))
    .filter((name): name is string => Boolean(name))
}

function getChartGroupName(scope: string, worldName: string | undefined): string {
  const kind = getScopeKind(scope)
  if (kind === 'region') return getDcNameByWorldName(worldName || '') || '未知'
  if (kind === 'dc') return worldName || '未知服务器'
  return worldName || scope
}

function getChartGroupOrder(scope: string, presentGroups: string[]): string[] {
  const present = new Set(presentGroups)
  const kind = getScopeKind(scope)

  if (kind === 'region') {
    const regionDcs = dataCenters.filter((dc) => dc.region === scope).map((dc) => dc.name)
    const ordered: string[] = CHINA_DC_NAMES.filter((name) => regionDcs.includes(name) && present.has(name))
    for (const dc of regionDcs) {
      if (!ordered.includes(dc) && present.has(dc)) ordered.push(dc)
    }
    return ordered
  }

  if (kind === 'dc') {
    const ordered = getWorldNamesInDc(scope).filter((name) => present.has(name))
    for (const group of presentGroups) {
      if (!ordered.includes(group)) ordered.push(group)
    }
    return ordered
  }

  return presentGroups.slice(0, 1)
}

function getChartGroupColor(scope: string, groupName: string) {
  const kind = getScopeKind(scope)
  if (kind === 'region') return getDcColor(groupName)
  if (kind === 'dc') {
    const index = getWorldNamesInDc(scope).indexOf(groupName)
    return SERVER_COLORS[index >= 0 ? index % SERVER_COLORS.length : 0]
  }
  return getDcColor(getDcNameByWorldName(groupName))
}

function formatGil(v: number): string {
  return v.toLocaleString('zh-CN')
}

function formatAxisGil(v: number): string {
  if (v >= 1000000) return `${Number((v / 1000000).toPrecision(3))}M`
  if (v >= 1000) return `${Number((v / 1000).toPrecision(3))}K`
  return formatGil(Math.round(v))
}

function formatDailySales(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '-'
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2
  return `${v.toLocaleString('zh-CN', { maximumFractionDigits: digits })}/天`
}

function percentile(sortedValues: number[], ratio: number): number {
  if (!sortedValues.length) return 0
  const index = Math.floor((sortedValues.length - 1) * ratio)
  return sortedValues[index]
}

function formatTime(ts: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD} 天前`
  return d.toLocaleDateString('zh-CN')
}

// 价格分布的迷你区间条：P25~P75 色带 + P50 中线 + 最低挂单圆点。
// 双条对比时由父级传入共享 domain，保证两条坐标对齐；单条时各自自适应。
function PriceRangeStrip(props: {
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

function ListingTableSkeleton() {
  return (
    <div class="space-y-2" aria-busy="true" aria-label="挂单加载中">
      <div class="grid grid-cols-[3rem_1fr_3rem_1fr_5rem_5rem] gap-4 px-3 py-2">
        <For each={Array.from({ length: 6 })}>
          {() => <Skeleton class="h-4 w-full" />}
        </For>
      </div>
      <For each={Array.from({ length: 8 })}>
        {() => (
          <div class="grid grid-cols-[3rem_1fr_3rem_1fr_5rem_5rem] gap-4 px-3 py-2">
            <Skeleton class="h-6 w-10" />
            <Skeleton class="h-5 w-24" />
            <Skeleton class="h-5 w-8" />
            <Skeleton class="h-5 w-28" />
            <Skeleton class="h-5 w-16" />
            <Skeleton class="h-5 w-16" />
          </div>
        )}
      </For>
    </div>
  )
}

function ListingChartSkeleton() {
  return (
    <Card class="mb-6 py-3" aria-busy="true" aria-label="挂单价格分布加载中">
      <CardHeader class="pb-2">
        <Skeleton class="h-5 w-28" />
        <Skeleton class="h-4 w-40" />
      </CardHeader>
      <CardContent class="pt-0">
        <div class="flex gap-2 mb-4">
          <Skeleton class="h-9 w-20" />
          <Skeleton class="h-9 w-24" />
        </div>
        <Skeleton class="h-[300px] w-full" />
      </CardContent>
    </Card>
  )
}

function filterOutliers(values: number[]): number[] {
  if (values.length < 4) return values
  const sorted = [...values].sort((a, b) => a - b)
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1
  const upper = q3 + 3 * iqr
  return values.filter((v) => v <= upper)
}

function computeStats(
  server: string,
  listings: any[],
  shouldFilter: boolean
) {
  const prices = listings
    .map((l) => Number(l.pricePerUnit ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0)
  const filtered = shouldFilter ? filterOutliers(prices) : prices
  if (!filtered.length) {
    return {
      server,
      dc: getDcNameByWorldName(server) || '未知',
      min: 0,
      max: 0,
      p25: 0,
      p75: 0,
      median: 0,
      count: 0,
      listingCount: listings.length,
      lastReviewTime: Math.max(0, ...listings.map((l) => Number(l.lastReviewTime ?? 0))) * 1000,
    }
  }
  const sorted = [...filtered].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const p25 = sorted[Math.floor(sorted.length * 0.25)]
  const p75 = sorted[Math.floor(sorted.length * 0.75)]
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const lastReviewTime = Math.max(0, ...listings.map((l) => Number(l.lastReviewTime ?? 0))) * 1000
  return {
    server,
    dc: getDcNameByWorldName(server) || '未知',
    min,
    max,
    p25,
    p75,
    median,
    count: filtered.length,
    listingCount: listings.length,
    lastReviewTime,
  }
}

type SalesTrend = 'up' | 'down' | 'flat'

function computeSalesVelocityByServer(history: any[]) {
  const daySeconds = 24 * 60 * 60
  const windowDays = 7
  const now = Math.floor(Date.now() / 1000)
  const recentStart = now - windowDays * daySeconds
  const previousStart = now - windowDays * 2 * daySeconds
  const byServer = new Map<string, { recent: number; previous: number }>()

  for (const sale of history ?? []) {
    const timestamp = Number(sale.timestamp ?? 0)
    const quantity = Number(sale.quantity ?? 0)
    if (!Number.isFinite(timestamp) || !Number.isFinite(quantity) || quantity <= 0) continue
    if (timestamp < previousStart || timestamp > now) continue

    const server = sale.worldName || '未知服务器'
    const totals = byServer.get(server) ?? { recent: 0, previous: 0 }
    if (timestamp >= recentStart) {
      totals.recent += quantity
    } else {
      totals.previous += quantity
    }
    byServer.set(server, totals)
  }

  const result = new Map<string, { dailySales: number; previousDailySales: number; trend: SalesTrend }>()
  for (const [server, totals] of byServer) {
    const dailySales = totals.recent / windowDays
    const previousDailySales = totals.previous / windowDays
    let trend: SalesTrend = 'flat'
    if (dailySales > previousDailySales) trend = 'up'
    if (dailySales < previousDailySales) trend = 'down'
    result.set(server, { dailySales, previousDailySales, trend })
  }

  return result
}

function SalesTrendIcon(props: { trend: SalesTrend }) {
  if (props.trend === 'up') {
    return (
      <svg class="size-3.5 text-emerald-500 shrink-0" aria-label="销量增长" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 19 0-14" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    )
  }

  if (props.trend === 'down') {
    return (
      <svg class="size-3.5 text-red-500 shrink-0" aria-label="销量降低" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 5 0 14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
    )
  }

  return <span class="inline-block size-3.5 shrink-0 text-center text-muted-foreground" aria-label="销量持平">-</span>
}

function ServerListingViolin(props: { listings: any[]; scope: string }) {
  let canvasRef!: HTMLCanvasElement

  createEffect(() => {
    const listings = props.listings
    const scope = props.scope
    if (!canvasRef || !listings?.length) return

    let chart: { destroy: () => void } | undefined
    let disposed = false
    onCleanup(() => {
      disposed = true
      chart?.destroy()
    })

    void loadChart(true).then((Chart) => {
      if (disposed || !canvasRef) return

      const existing = Chart.getChart(canvasRef)
      if (existing) existing.destroy()

      const ctx = canvasRef.getContext('2d')
      if (!ctx) return

      const byServer: Record<string, number[]> = {}
      for (const l of listings) {
        const name = l.worldName || '未知服务器'
        if (!byServer[name]) byServer[name] = []
        byServer[name].push(l.pricePerUnit)
      }

      const servers = Object.keys(byServer).sort((a, b) => {
        const dcA = getDcNameByWorldName(a) || '未知'
        const dcB = getDcNameByWorldName(b) || '未知'
        if (dcA !== dcB) return dcA.localeCompare(dcB)
        return byServer[b].length - byServer[a].length
      })
      const filteredData = servers.map((s) => filterOutliers(byServer[s]))

      const serverDcs = servers.map((s) => getDcNameByWorldName(s) || '未知')
      const serverGroups = servers.map((server) => getChartGroupName(scope, server))
      const legendGroups = getChartGroupOrder(scope, Array.from(new Set(serverGroups)))
      const bgColors = serverGroups.map((group) => getChartGroupColor(scope, group).bg)
      const borderColors = serverGroups.map((group) => getChartGroupColor(scope, group).solid)

      const serverStats = new Map<string, { min: number; max: number; median: number; mean: number; count: number; dc: string }>()
      for (let i = 0; i < servers.length; i++) {
        const arr = filteredData[i]
        if (!arr.length) continue
        const sorted = [...arr].sort((a, b) => a - b)
        const min = sorted[0]
        const max = sorted[sorted.length - 1]
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length
        serverStats.set(servers[i], { min, max, median, mean, count: arr.length, dc: serverDcs[i] })
      }

      chart = new Chart(ctx, {
        type: 'violin' as any,
        data: {
          labels: servers,
          datasets: [
            {
              label: '挂单价格分布',
              data: filteredData as any,
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: getScopeKind(scope) !== 'world',
              position: 'top',
              onClick: () => undefined,
              labels: {
                generateLabels: () => legendGroups.map((name, index) => ({
                  text: name,
                  fillStyle: getChartGroupColor(scope, name).bg,
                  strokeStyle: getChartGroupColor(scope, name).solid,
                  lineWidth: 1,
                  hidden: false,
                  datasetIndex: 0,
                  index,
                })),
              },
            },
            tooltip: {
              backgroundColor: '#ffffff',
              titleColor: '#0a0a0a',
              bodyColor: '#0a0a0a',
              borderColor: '#e5e5e5',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                title: (items: any[]) => items[0]?.label || '',
                label: () => '',
                afterBody: (items: any[]) => {
                  const server = items[0]?.label
                  if (!server) return []
                  const s = serverStats.get(server)
                  if (!s) return []
                  const fmt = (n: number) => n.toLocaleString('zh-CN')
                  return [
                    `大区: ${s.dc}`,
                    `样本数: ${s.count}`,
                    `最低: ${fmt(s.min)} Gil`,
                    `中位数: ${fmt(s.median)} Gil`,
                    `平均: ${fmt(Math.round(s.mean))} Gil`,
                    `最高: ${fmt(s.max)} Gil`,
                  ]
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 45, minRotation: 0 },
            },
            y: {
              type: 'logarithmic',
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                callback: (v: any) => {
                  if (typeof v !== 'number') return v
                  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
                  return v.toLocaleString('zh-CN')
                },
              },
            },
          },
        },
      })

      if (disposed) chart.destroy()
    })
  })

  return (
    <div class="h-[240px] sm:h-[320px] w-full" role="img" aria-label="服务器挂单价格小提琴图">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}

function ServerListingBarChart(props: { listings: any[]; history: any[]; scope: string; historyLoading: boolean }) {
  const [hideOutliers, setHideOutliers] = createSignal(true)

  const serverData = createMemo(() => {
    const listings = props.listings
    if (!listings?.length) {
      return {
        data: [] as (ReturnType<typeof computeStats> & {
          dailySales: number
          previousDailySales: number
          salesTrend: SalesTrend
        })[],
        scaleMin: 0,
        scaleMax: 0,
        fullMin: 0,
        fullMax: 0,
      }
    }

    const byServer: Record<string, any[]> = {}
    for (const l of listings) {
      const name = l.worldName || '未知服务器'
      if (!byServer[name]) byServer[name] = []
      byServer[name].push(l)
    }

    const servers = Object.keys(byServer).sort((a, b) => {
      const groupA = getChartGroupName(props.scope, a)
      const groupB = getChartGroupName(props.scope, b)
      const groupOrder = getChartGroupOrder(props.scope, [groupA, groupB])
      const orderA = groupOrder.indexOf(groupA)
      const orderB = groupOrder.indexOf(groupB)
      if (orderA !== orderB) return orderA - orderB
      const dcA = getDcNameByWorldName(a) || '未知'
      const dcB = getDcNameByWorldName(b) || '未知'
      if (dcA !== dcB) return dcA.localeCompare(dcB)
      return byServer[b].length - byServer[a].length
    })

    const salesByServer = computeSalesVelocityByServer(props.history)
    const data = servers.map((server) => {
      const sales = salesByServer.get(server) ?? { dailySales: 0, previousDailySales: 0, trend: 'flat' as SalesTrend }
      return {
        ...computeStats(server, byServer[server], hideOutliers()),
        dailySales: sales.dailySales,
        previousDailySales: sales.previousDailySales,
        salesTrend: sales.trend,
      }
    })
    const maxPrice = data.length > 0 ? Math.max(...data.map((d) => d.max)) : 0

    const mins = data.map((d) => d.min).filter((v) => v > 0)
    const p75s = data.map((d) => d.p75).filter((v) => v > 0)
    if (!mins.length || !p75s.length) return { data, scaleMin: 0, scaleMax: maxPrice, fullMin: 0, fullMax: maxPrice }

    const minPrice = Math.min(...mins)
    const focusedP75s = filterOutliers(p75s)
    const upperPrice = Math.max(...(focusedP75s.length ? focusedP75s : p75s), minPrice)
    const span = Math.max(upperPrice - minPrice, minPrice * 0.1, 1)

    return {
      data,
      scaleMin: Math.max(0, minPrice - span * 0.08),
      scaleMax: upperPrice + span * 0.12,
      fullMin: 0,
      fullMax: maxPrice,
    }
  })

  const valuePct = (value: number) => {
    const { scaleMin, scaleMax, fullMin, fullMax } = serverData()
    const span = scaleMax - scaleMin
    if (span <= 0) return 0

    const leftFoldPct = scaleMin > fullMin ? 6 : 0
    const rightFoldPct = fullMax > scaleMax ? 8 : 0
    const focusStart = leftFoldPct
    const focusEnd = 100 - rightFoldPct

    if (value < scaleMin) {
      const leftSpan = scaleMin - fullMin
      if (leftSpan <= 0) return 0
      return Math.min(focusStart, Math.max(0, ((value - fullMin) / leftSpan) * focusStart))
    }

    if (value > scaleMax) {
      const rightSpan = fullMax - scaleMax
      if (rightSpan <= 0) return 100
      return Math.min(100, Math.max(focusEnd, focusEnd + ((value - scaleMax) / rightSpan) * rightFoldPct))
    }

    return focusStart + ((value - scaleMin) / span) * (focusEnd - focusStart)
  }

  const axisTicks = createMemo(() => {
    const { scaleMin, scaleMax, fullMax } = serverData()
    if (scaleMax <= scaleMin) return []

    const ticks = [
      { value: scaleMin, label: formatGil(Math.round(scaleMin)) },
      { value: (scaleMin + scaleMax) / 2, label: formatGil(Math.round((scaleMin + scaleMax) / 2)) },
      { value: scaleMax, label: formatGil(Math.round(scaleMax)) },
      ...(fullMax > scaleMax ? [{ value: fullMax, label: formatGil(Math.round(fullMax)) }] : []),
    ]

    const mapped = ticks.map((tick) => ({ ...tick, label: formatAxisGil(tick.value), left: valuePct(tick.value) }))
    return mapped.filter((tick, index) => index === 0 || Math.abs(tick.left - mapped[index - 1].left) >= 8)
  })

  const legendGroups = createMemo(() => {
    const groups = Array.from(new Set(serverData().data.map((item) => getChartGroupName(props.scope, item.server))))
    return getChartGroupOrder(props.scope, groups)
  })

  const Axis = (props: { position: 'top' | 'bottom' }) => (
    <div
      class={
        'relative h-6 border-muted/60 ' +
        (props.position === 'top' ? 'border-b mb-0.5' : 'border-t mt-0.5')
      }
      aria-hidden="true"
    >
      <For each={axisTicks()}>
        {(tick) => (
          <>
            <div
              class={
                'absolute h-1.5 w-px bg-muted-foreground/35 ' +
                (props.position === 'top' ? 'bottom-0' : 'top-0')
              }
              style={{ left: `${tick.left}%` }}
            />
            <span
              class={
                'absolute text-[10px] leading-none text-muted-foreground tabular-nums whitespace-nowrap ' +
                (props.position === 'top' ? 'bottom-2' : 'top-2')
              }
              style={{
                left: `${tick.left}%`,
                transform: tick.left <= 2 ? 'translateX(0)' : tick.left >= 98 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {tick.label}
            </span>
          </>
        )}
      </For>
    </div>
  )

  return (
    <div>
      <div class="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
        <Show when={legendGroups().length > 0}>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="分组颜色图例">
            <For each={legendGroups()}>
              {(group) => {
                const color = getChartGroupColor(props.scope, group)
                return (
                  <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      class="size-2.5 rounded-[2px] border"
                      style={{
                        'background-color': `${color.solid}cc`,
                        'border-color': color.solid,
                      }}
                      aria-hidden="true"
                    />
                    <span>{group}</span>
                  </span>
                )
              }}
            </For>
          </div>
        </Show>
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
            忽略异常高价
            <Tooltip>
              <TooltipTrigger
                class="inline-flex items-center text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                aria-label="忽略异常高价的机制说明"
                onClick={(e) => e.preventDefault()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent class="max-w-64 whitespace-normal">
                  按每个服务器的挂单价计算四分位距（IQR = P75 − P25），移除高于 P75 + 3×IQR 的挂单；挂单少于 4 个时不过滤。影响最低价、中位价、P25~P75 统计和条形范围。
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          </span>
          <button
            role="switch"
            aria-checked={hideOutliers()}
            onClick={() => setHideOutliers(!hideOutliers())}
            class={
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ' +
              (hideOutliers() ? 'bg-primary' : 'bg-input')
            }
          >
            <span
              class={
                'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ' +
                (hideOutliers() ? 'translate-x-4' : 'translate-x-0')
              }
            />
          </button>
        </label>
      </div>

      {/* 统一 grid：表头和数据在同一个 grid 中，列宽全局一致 */}
      <div class="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div class="grid grid-cols-[minmax(4.5rem,auto)_minmax(4.5rem,auto)_minmax(5.5rem,auto)_minmax(3.5rem,auto)_minmax(12rem,1fr)_minmax(3.5rem,auto)_minmax(5.5rem,auto)_minmax(5rem,auto)] gap-x-2 sm:gap-x-3 gap-y-1 text-xs px-0.5 min-w-[790px]">
        {/* 表头 */}
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">最低价</span>
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">中位价</span>
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">P25~P75</span>
        <span class="text-right whitespace-nowrap text-muted-foreground">服务器</span>
        <Axis position="top" />
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">挂单量</span>
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">日均销量</span>
        <span class="text-right whitespace-nowrap text-muted-foreground">上次更新</span>

        {/* 数据行：display: contents 让子元素直接参与父级 grid */}
        <For each={serverData().data}>
          {(item) => {
            const listingPct = valuePct(item.min)
            const p25Pct = valuePct(item.p25)
            const p75Pct = valuePct(item.p75)
            const medianPct = valuePct(item.median)
            const rangeW = p75Pct - p25Pct
            const color = getChartGroupColor(props.scope, getChartGroupName(props.scope, item.server))

            return (
              <div class="contents group cursor-pointer">
                <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground group-hover:bg-accent/5 rounded px-0.5 py-0.5">
                  {formatGil(item.min)}
                </span>
                <span class="text-right tabular-nums whitespace-nowrap text-amber-500 group-hover:bg-accent/5 rounded px-0.5 py-0.5">
                  {formatGil(item.median)}
                </span>
                <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground group-hover:bg-accent/5 rounded px-0.5 py-0.5">
                  {formatGil(item.p25)}~{formatGil(item.p75)}
                </span>
                <span class="text-muted-foreground truncate text-right whitespace-nowrap group-hover:bg-accent/5 rounded px-0.5 py-0.5" title={item.server}>
                  {item.server}
                </span>
                <div class="h-4 bg-muted/30 rounded-sm relative overflow-hidden min-w-0">
                  {/* P25~P75 区间 */}
                  <div
                    class="absolute h-full rounded-sm"
                    style={{
                      left: `${p25Pct}%`,
                      width: `${Math.max(rangeW, 0.5)}%`,
                      background: `${color.solid}33`,
                      border: `1px solid ${color.solid}66`,
                    }}
                  />
                  {/* 最低挂单条 */}
                  <div
                    class="absolute h-full rounded-l-sm"
                    style={{
                      width: `${listingPct}%`,
                      'background-color': `${color.solid}cc`,
                    }}
                  />
                  {/* 中位线 */}
                  <div
                    class="absolute h-full w-[2px]"
                    style={{
                      left: `${medianPct}%`,
                      'background-color': '#fbbf24',
                    }}
                  />
                </div>
                <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground group-hover:bg-accent/5 rounded px-0.5 py-0.5">
                  {item.listingCount.toLocaleString('zh-CN')}
                </span>
                <span
                  class="inline-flex items-center justify-end gap-1 text-right tabular-nums whitespace-nowrap text-muted-foreground group-hover:bg-accent/5 rounded px-0.5 py-0.5"
                  title={props.historyLoading ? undefined : `最近 7 天 ${formatDailySales(item.dailySales)}，前 7 天 ${formatDailySales(item.previousDailySales)}`}
                >
                  {/* 销量由 history 接口计算，未就绪前显示骨架而非 "-"，避免被误读为无数据 */}
                  <Show when={!props.historyLoading} fallback={<Skeleton class="h-3 w-10" />}>
                    <span>{formatDailySales(item.dailySales)}</span>
                    <SalesTrendIcon trend={item.salesTrend} />
                  </Show>
                </span>
                <span class="text-right whitespace-nowrap text-muted-foreground group-hover:bg-accent/5 rounded px-0.5 py-0.5" title={item.lastReviewTime ? new Date(item.lastReviewTime).toLocaleString('zh-CN') : undefined}>
                  {formatTime(item.lastReviewTime)}
                </span>
              </div>
            )
          }}
        </For>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <Axis position="bottom" />
        <div></div>
        <div></div>
        <div></div>
      </div>
      </div>
    </div>
  )
}

function ServerHistoryTrendChart(props: { history: any[] }) {
  let canvasRef!: HTMLCanvasElement

  createEffect(() => {
    const data = props.history
    if (!canvasRef || !data?.length) return

    let chart: { destroy: () => void } | undefined
    let disposed = false
    onCleanup(() => {
      disposed = true
      chart?.destroy()
    })

    void loadChart().then((Chart) => {
      if (disposed || !canvasRef) return

      const existing = Chart.getChart(canvasRef)
      if (existing) existing.destroy()

      const ctx = canvasRef.getContext('2d')
      if (!ctx) return

      const byDay: Record<string, { prices: number[]; volume: number }> = {}
      for (const h of data) {
        const d = new Date(h.timestamp * 1000)
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (!byDay[day]) byDay[day] = { prices: [], volume: 0 }
        byDay[day].prices.push(h.pricePerUnit)
        byDay[day].volume += h.quantity
      }

      const days = Object.keys(byDay).sort()
      const dayLabels = days.map(d => {
        const [, m, day] = d.split('-')
        return `${Number(m)}/${Number(day)}`
      })
      const avgPrices = days.map(d => {
        const arr = byDay[d].prices
        return arr.reduce((a, b) => a + b, 0) / arr.length
      })
      const minPrices = days.map(d => Math.min(...byDay[d].prices))
      const maxPrices = days.map(d => Math.max(...byDay[d].prices))
      const volumes = days.map(d => byDay[d].volume)

      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dayLabels,
          datasets: [
            {
              label: '成交量',
              type: 'bar' as any,
              data: volumes,
              yAxisID: 'y1',
              barMaxWidth: 12,
              backgroundColor: 'rgba(74, 222, 128, 0.4)',
            },
            {
              label: '均价',
              data: avgPrices,
              borderColor: '#6366f1',
              backgroundColor: '#6366f1',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
            {
              label: '最低',
              data: minPrices,
              borderColor: 'transparent',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              fill: '+1',
              pointRadius: 0,
              tension: 0.3,
            },
            {
              label: '最高',
              data: maxPrices,
              borderColor: 'transparent',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              fill: false,
              pointRadius: 0,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
              backgroundColor: '#ffffff',
              titleColor: '#0a0a0a',
              bodyColor: '#0a0a0a',
              borderColor: '#e5e5e5',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (item: any) => {
                  const v = item.parsed?.y
                  if (v == null) return ''
                  return `${item.dataset.label}: ${v.toLocaleString('zh-CN')}${item.datasetIndex === 0 ? '' : ' Gil'}`
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxTicksLimit: 8 },
            },
            y: {
              type: 'logarithmic',
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                callback: (v: any) => {
                  if (typeof v !== 'number') return v
                  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
                  return v.toLocaleString('zh-CN')
                },
              },
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { display: false },
              display: true,
            },
          },
        },
      })

      if (disposed) chart.destroy()
    })
  })

  return (
    <div class="h-[240px] sm:h-[320px] w-full" role="img" aria-label="服务器历史价格走势图">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}

function ServerHistoryScatterChart(props: { history: any[]; scope: string }) {
  let canvasRef!: HTMLCanvasElement

  createEffect(() => {
    const data = props.history
    const scope = props.scope
    if (!canvasRef || !data?.length) return

    let chart: { destroy: () => void } | undefined
    let disposed = false
    onCleanup(() => {
      disposed = true
      chart?.destroy()
    })

    void loadChart().then((Chart) => {
      if (disposed || !canvasRef) return

      const existing = Chart.getChart(canvasRef)
      if (existing) existing.destroy()

      const ctx = canvasRef.getContext('2d')
      if (!ctx) return

      const now = Date.now()
      const day7Ago = now - 7 * 24 * 60 * 60 * 1000
      const filtered = data.filter(h => h.timestamp * 1000 >= day7Ago)

      const allPrices = filtered.map(h => h.pricePerUnit)
      const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0

      const scopeKind = getScopeKind(scope)
      const byGroup: Record<string, any[]> = {}

      for (const h of filtered) {
        const group = getChartGroupName(scope, h.worldName)
        if (!byGroup[group]) byGroup[group] = []
        byGroup[group].push({
          x: h.timestamp * 1000,
          y: h.pricePerUnit,
          qty: h.quantity,
          world: h.worldName,
        })
      }

      const groupNames = getChartGroupOrder(scope, Object.keys(byGroup))
      const datasets = groupNames.map(name => ({
        label: name,
        data: byGroup[name],
        pointRadius: (ctx: any) => {
          const qty = ctx.raw?.qty ?? 1
          return Math.min(20, Math.max(6, qty * 2))
        },
        pointBackgroundColor: getChartGroupColor(scope, name).point,
        pointBorderColor: 'transparent',
      }))

      if (scopeKind === 'world' && datasets.length === 0) {
        datasets.push({
          label: scope,
          data: filtered.map(h => ({
            x: h.timestamp * 1000,
            y: h.pricePerUnit,
            qty: h.quantity,
            world: h.worldName,
          })),
          pointRadius: (ctx: any) => {
            const qty = ctx.raw?.qty ?? 1
            return Math.min(20, Math.max(6, qty * 2))
          },
          pointBackgroundColor: getChartGroupColor(scope, scope).point,
          pointBorderColor: 'transparent',
        })
      }

      chart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: scopeKind !== 'world', position: 'top' },
            tooltip: {
              backgroundColor: '#ffffff',
              titleColor: '#0a0a0a',
              bodyColor: '#0a0a0a',
              borderColor: '#e5e5e5',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                title: (items: any[]) => {
                  const raw = items[0]?.raw
                  if (!raw) return ''
                  const d = new Date(raw.x)
                  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                },
                label: (item: any) => {
                  const raw = item.raw
                  const lines: string[] = []
                  lines.push(`单价: ${raw.y.toLocaleString('zh-CN')} Gil`)
                  lines.push(`数量: ${raw.qty}`)
                  if (raw.world) lines.push(`服务器: ${raw.world}`)
                  return lines
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              min: day7Ago,
              max: now,
              grid: { display: false },
              ticks: {
                maxTicksLimit: 8,
                callback: (v: any) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                },
              },
            },
            y: {
              min: 0,
              max: Math.ceil(maxPrice * 1.1),
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                callback: (v: any) => {
                  if (typeof v !== 'number') return v
                  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`
                  return v.toLocaleString('zh-CN')
                },
              },
            },
          },
        },
      })

      if (disposed) chart.destroy()
    })
  })

  return (
    <div class="h-[240px] sm:h-[300px] w-full" role="img" aria-label="服务器历史成交散点图">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}

export default function ItemDetail() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const itemId = createMemo(() => params.id)
  const [activeTab, setActiveTab] = createSignal('listings')
  const [listingChartTab, setListingChartTab] = createSignal('bar')
  const [historyChartTab, setHistoryChartTab] = createSignal('line')
  const [copied, setCopied] = createSignal(false)
  const [scope, setScope] = createSignal(selectedRegion())
  const [isScrolled, setIsScrolled] = createSignal(false)

  createEffect(() => {
    const name = getItemName(Number(itemId()))
    document.title = name ? `XIV Market - ${name}` : 'XIV Market'
  })

  onCleanup(() => {
    document.title = 'XIV Market'
  })

  createEffect(on(selectedRegion, (region) => {
    setScope(region)
  }))

  let sentinelRef!: HTMLDivElement

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-56px 0px 0px 0px' }
    )
    if (sentinelRef) observer.observe(sentinelRef)
    onCleanup(() => observer.disconnect())
  })

  const worldNameById = createMemo(() => {
    const map = new Map<number, string>()
    for (const world of worlds) {
      map.set(world.id, world.name)
    }
    return map
  })

  const scopedWorldNames = createMemo(() => {
    const s = scope()
    const map = worldNameById()

    const regionDcs = dataCenters.filter((dc) => dc.region === s)
    if (regionDcs.length) {
      const names = new Set<string>()
      for (const dc of regionDcs) {
        for (const worldId of dc.worlds) {
          const name = map.get(worldId)
          if (name) names.add(name)
        }
      }
      return names
    }

    const dc = dataCenters.find((d) => d.name === s)
    if (dc) {
      const names = new Set<string>()
      for (const worldId of dc.worlds) {
        const name = map.get(worldId)
        if (name) names.add(name)
      }
      return names
    }

    return new Set([s])
  })

  const filterRowsByScope = <T extends { worldName?: string }>(rows: T[]) => {
    const names = scopedWorldNames()
    return rows.filter((row) => {
      if (row.worldName) return names.has(row.worldName)
      return names.size === 1 && names.has(scope())
    })
  }

  // 按当前 scope 请求：history 端点每次查询有 1800 条上限且整个 scope 共享，
  // region 级响应对热门物品达不到 30 天深度，dc/world 直查有独立额度、数据更完整，
  // 因此切 scope 必须重新请求（在途旧请求由 api.ts 的 AbortController 取消）
  const [marketDataResult, { refetch: refetchMarketData }] = createResource(
    () => {
      const id = itemId()
      if (!id) return null
      return { scope: scope(), id }
    },
    async ({ scope, id }: { scope: string; id: string }) => ({
      scope,
      id,
      data: await fetchMarketData(scope, id),
    })
  )

  const [historyDataResult, { refetch: refetchHistoryData }] = createResource(
    () => {
      const id = itemId()
      if (!id) return null
      return { scope: scope(), id }
    },
    async ({ scope, id }: { scope: string; id: string }) => ({
      scope,
      id,
      data: await fetchHistoryData(scope, id),
    })
  )

  const handleRefresh = () => {
    refetchMarketData()
    refetchHistoryData()
  }

  const marketData = createMemo(() => {
    const result = marketDataResult()
    if (!result || result.scope !== scope() || result.id !== itemId()) return null
    const id = Number(itemId())
    return result.data[id] ?? null
  })

  const currentListings = createMemo(() => filterRowsByScope(marketData()?.listings ?? []))
  const history = createMemo(() => {
    const result = historyDataResult()
    if (!result || result.scope !== scope() || result.id !== itemId()) return []
    return filterRowsByScope(result.data.entries ?? [])
  })
  const isMarketDataLoading = createMemo(() => {
    const result = marketDataResult()
    return marketDataResult.loading || Boolean(result && (result.scope !== scope() || result.id !== itemId()))
  })
  // 只在"没有任何可展示数据"时才用骨架屏：
  // 初次加载/切 scope 时 marketData() 为空 → 骨架屏；
  // 同 scope 点刷新（refetch）时旧数据仍然有效 → 保留内容，由刷新按钮的旋转表达加载中
  const showMarketSkeleton = createMemo(() => isMarketDataLoading() && !marketData())
  // 成交历史同理：加载中且无数据时显示骨架屏，而不是闪现「暂无历史数据」
  const showHistorySkeleton = createMemo(() => {
    const result = historyDataResult()
    const stale = Boolean(result && (result.scope !== scope() || result.id !== itemId()))
    return (historyDataResult.loading || stale) && history().length === 0
  })
  const showHistoryWorld = createMemo(() =>
    history().some((sale) => Boolean(sale.worldName) && sale.worldName !== scope())
  )

  const stats = createMemo(() => {
    const data = marketData()
    if (!data) return null
    const listings = currentListings()
    const priceOf = (listing: any) => Number(listing.pricePerUnit ?? 0)
    const isValid = (listing: any) => Number.isFinite(priceOf(listing)) && priceOf(listing) > 0
    const byPriceAsc = (a: any, b: any) => {
      const priceDiff = Number(a.pricePerUnit) - Number(b.pricePerUnit)
      if (priceDiff !== 0) return priceDiff
      return Number(a.total ?? 0) - Number(b.total ?? 0)
    }

    // NQ/HQ 是两个独立的价格体系，最低挂单与分布都按品质分别统计
    const minListingOf = (hq: boolean) =>
      listings.filter((l) => isValid(l) && Boolean(l.hq) === hq).slice().sort(byPriceAsc)[0] ?? null
    const distOf = (hq: boolean) => {
      const sorted = listings
        .filter((l) => isValid(l) && Boolean(l.hq) === hq)
        .map(priceOf)
        .sort((a, b) => a - b)
      if (!sorted.length) return null
      return {
        min: sorted[0],
        p25: percentile(sorted, 0.25),
        p50: percentile(sorted, 0.5),
        p75: percentile(sorted, 0.75),
      }
    }

    return {
      velocity: data.regularSaleVelocity,
      nqVelocity: data.nqSaleVelocity,
      hqVelocity: data.hqSaleVelocity,
      lastUploadTime: data.lastUploadTime,
      listingCount: listings.length,
      nqMinListing: minListingOf(false),
      hqMinListing: minListingOf(true),
      nqDist: distOf(false),
      hqDist: distOf(true),
    }
  })

  // NQ/HQ 双条对比时的共享坐标域，让两条区间条可以上下直观对比
  const sharedDistDomain = createMemo(() => {
    const nq = stats()?.nqDist
    const hq = stats()?.hqDist
    if (!nq || !hq) return null
    const lo = Math.min(nq.min, hq.min)
    const hi = Math.max(nq.p75, hq.p75)
    const span = hi - lo
    const pad = span > 0 ? span * 0.25 : Math.max(hi * 0.1, 1)
    return { lo: lo - pad, hi: hi + pad }
  })

  // NQ/HQ 品质筛选：仅双品质物品显示切换；默认 HQ（无 HQ 数据时兜底 NQ），
  // 用户手动切换后不再自动改动。统计卡保持双品质对比（未选中的淡化），
  // 下方图表/表格按所选品质过滤。
  const [qualityFilter, setQualityFilter] = createSignal<'nq' | 'hq'>('hq')
  let qualityTouched = false
  const bothQualities = createMemo(() => Boolean(stats()?.nqDist && stats()?.hqDist))
  createEffect(() => {
    if (qualityTouched) return
    const s = stats()
    if (!s) return
    setQualityFilter(s.hqDist ? 'hq' : 'nq')
  })
  const handleQualityChange = (q: 'nq' | 'hq') => {
    qualityTouched = true
    setQualityFilter(q)
  }
  const filteredListings = createMemo(() => {
    const listings = currentListings()
    if (!bothQualities()) return listings
    const wantHq = qualityFilter() === 'hq'
    return listings.filter((l) => Boolean(l.hq) === wantHq)
  })
  const filteredHistory = createMemo(() => {
    const entries = history()
    if (!bothQualities()) return entries
    const wantHq = qualityFilter() === 'hq'
    return entries.filter((e) => Boolean(e.hq) === wantHq)
  })
  // 统计卡中未选中品质的行淡化
  const qualityRowClass = (q: 'nq' | 'hq') =>
    'transition-opacity ' + (qualityFilter() === q ? '' : 'opacity-40')

  // 品质行：badge + 最低挂单 + 价格分布条，双品质时整行可点击选择
  const QualityRow = (props: {
    hq: boolean
    dist: { min: number; p25: number; p50: number; p75: number }
    minListing: any
    selectable: boolean
  }) => {
    const selected = () => qualityFilter() === (props.hq ? 'hq' : 'nq')
    return (
      <button
        type="button"
        disabled={!props.selectable}
        aria-pressed={props.selectable ? selected() : undefined}
        onClick={() => props.selectable && handleQualityChange(props.hq ? 'hq' : 'nq')}
        class={
          'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-all ' +
          (props.selectable
            ? 'cursor-pointer hover:bg-accent/60 ' + (selected() ? '' : 'opacity-40')
            : 'cursor-default')
        }
      >
        <QualityBadge hq={props.hq} class="shrink-0" />
        <div class="w-32 shrink-0">
          <Show when={props.minListing} fallback={<span class="text-muted-foreground">-</span>}>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-bold tracking-tight tabular-nums">
                {formatGil(Number(props.minListing.pricePerUnit))}
              </span>
              <span class="text-xs text-muted-foreground">Gil</span>
            </div>
            <WorldBadge
              class="text-[10px] text-muted-foreground"
              worldName={props.minListing.worldName || scope()}
            />
          </Show>
        </div>
        <div class="min-w-0 flex-1">
          <PriceRangeStrip
            min={props.dist.min}
            p25={props.dist.p25}
            p50={props.dist.p50}
            p75={props.dist.p75}
            domain={sharedDistDomain() ?? undefined}
          />
        </div>
      </button>
    )
  }

  const qualityToggle = () => (
    <Show when={bothQualities()}>
      {/* 两态切换：点击整个区域即翻到另一品质 */}
      <button
        type="button"
        class="inline-flex cursor-pointer items-center rounded-md border border-input bg-background p-0.5 text-xs font-medium"
        aria-label="切换 NQ/HQ 品质筛选"
        title="切换 NQ/HQ 品质筛选"
        onClick={() => handleQualityChange(qualityFilter() === 'hq' ? 'nq' : 'hq')}
      >
        <span
          class={
            'rounded px-1.5 py-0.5 transition-colors ' +
            (qualityFilter() === 'nq'
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground')
          }
        >
          NQ
        </span>
        <span
          class={
            'rounded px-1.5 py-0.5 transition-colors ' +
            (qualityFilter() === 'hq'
              ? 'bg-amber-100 text-amber-800'
              : 'text-muted-foreground')
          }
        >
          HQ
        </span>
      </button>
    </Show>
  )

  const handleCopyName = () => {
    const name = getItemName(Number(itemId()))
    navigator.clipboard.writeText(name).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const backHref = createMemo(() => {
    const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : ''
    return q ? `/?q=${encodeURIComponent(q)}` : '/'
  })

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Sentinel: Intersection Observer 监听此元素是否离开视口 */}
      <div ref={sentinelRef} class="h-px -mt-px" />

      {/* Sticky Header */}
      <div
        class={
          'sticky top-14 z-40 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 flex items-center gap-2 sm:gap-3 transition-all duration-300 ' +
          (isScrolled() ? 'h-14 py-2 bg-background/80 backdrop-blur-md shadow-sm' : 'h-20 py-3 mb-6 sm:py-4 sm:mb-8')
        }
      >
        {/* 返回按钮 */}
        <A
          href={backHref()}
          class="flex-shrink-0 rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-300 h-8 w-8"
          title="返回市场"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </A>

        {/* 物品图标 */}
        <Show when={getItemIconUrl(Number(itemId())).length > 0}>
          <img
            src={getItemIconUrl(Number(itemId()))[0]}
            alt=""
            class={
              'rounded flex-shrink-0 transition-all duration-300 ' +
              (isScrolled() ? 'h-6 w-6' : 'h-10 w-10')
            }
            onError={(e) => {
              const urls = getItemIconUrl(Number(itemId()))
              if (urls.length > 1) {
                e.currentTarget.src = urls[1]
              } else {
                e.currentTarget.style.display = 'none'
              }
            }}
          />
        </Show>

        {/* 物品信息 */}
        <div class="min-w-0 flex-1">
          {/* 第一行：名称 + 操作按钮（移动端）/ 名称 + 按钮 + ScopeSelect（桌面端） */}
          <div class="flex items-center gap-1 sm:gap-2">
            <h1
              class={
                'font-semibold tracking-tight truncate transition-all duration-300 ' +
                (isScrolled() ? 'text-base' : 'text-xl sm:text-2xl')
              }
            >
              {getItemName(Number(itemId()))}
            </h1>

            {/* 操作按钮组 */}
            <div class="flex items-center gap-0.5 flex-shrink-0">
              {/* 复制按钮 */}
              <Tooltip>
                <TooltipTrigger
                  onClick={handleCopyName}
                  class={
                    'rounded-md hover:bg-accent/80 hover:text-accent-foreground transition-all duration-200 flex items-center justify-center text-muted-foreground ' +
                    (isScrolled() ? 'h-6 w-6' : 'h-7 w-7')
                  }
                  aria-label={copied() ? '已复制' : '复制名称'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={isScrolled() ? 'h-3.5 w-3.5' : 'h-4 w-4'}>
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent>{copied() ? '已复制' : '复制名称'}</TooltipContent>
                </TooltipPortal>
              </Tooltip>

              {/* 灰机wiki */}
              <Tooltip>
                <TooltipTrigger
                  as="a"
                  href={`https://ff14.huijiwiki.com/wiki/${encodeURIComponent('物品:' + getItemName(Number(itemId())))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class={
                    'rounded-md hover:bg-accent/80 hover:opacity-100 opacity-70 transition-all duration-200 flex items-center justify-center overflow-hidden ' +
                    (isScrolled() ? 'h-6 w-6' : 'h-7 w-7')
                  }
                  aria-label="在灰机wiki查看"
                >
                  <img src={`${baseUrl()}huiji.webp`} alt="灰机wiki" class={isScrolled() ? 'h-3.5 w-3.5' : 'h-4 w-4'} draggable="false" />
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent>在灰机wiki查看</TooltipContent>
                </TooltipPortal>
              </Tooltip>

              {/* Garland Tools */}
              <Tooltip>
                <TooltipTrigger
                  as="a"
                  href={`https://garlandtools.cn/db/#item/${itemId()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class={
                    'rounded-md hover:bg-accent/80 hover:opacity-100 opacity-70 transition-all duration-200 flex items-center justify-center overflow-hidden ' +
                    (isScrolled() ? 'h-6 w-6' : 'h-7 w-7')
                  }
                  aria-label="在 Garland Tools 查看"
                >
                  <img src={`${baseUrl()}garland.webp`} alt="Garland Tools" class={isScrolled() ? 'h-3.5 w-3.5' : 'h-4 w-4'} draggable="false" />
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent>在 Garland Tools 查看</TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </div>

            <div class="flex-1 min-w-2 sm:min-w-4" />

            {/* 更新时间 - 桌面端 */}
            <div
              class={
                'hidden sm:block flex-shrink-0 transition-all duration-300 ' +
                (isScrolled() ? 'opacity-0 w-0' : 'opacity-100')
              }
            >
              <Show when={stats()?.lastUploadTime}>
                <p class="text-sm text-muted-foreground whitespace-nowrap">
                  更新于 {formatTime(stats()?.lastUploadTime ?? 0)}
                </p>
              </Show>
            </div>

            {/* 数据范围选择器 + 品质筛选 + 刷新按钮 - 桌面端 */}
            <div class="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              {qualityToggle()}
              <ScopeSelect value={scope()} onChange={setScope} region={selectedRegion()} />
              <RefreshButton
                loading={marketDataResult.loading || historyDataResult.loading}
                onClick={handleRefresh}
                class={isScrolled() ? 'size-6' : 'size-7'}
              />
            </div>
          </div>

          {/* 第二行：ID（移动端）/ ID + ScopeSelect（桌面端） */}
          <div
            class={
              'flex items-center gap-2 transition-all duration-300 overflow-hidden ' +
              (isScrolled() ? 'h-0 opacity-0 mt-0' : 'h-5 opacity-100 mt-1')
            }
          >
            <span class="text-sm text-muted-foreground">#{itemId()}</span>
            <div class="flex-1" />
            {/* 移动端 ScopeSelect + 品质筛选 + 刷新按钮 */}
            <div class="sm:hidden flex items-center gap-1.5">
              {qualityToggle()}
              <ScopeSelect value={scope()} onChange={setScope} region={selectedRegion()} />
              <RefreshButton
                loading={marketDataResult.loading || historyDataResult.loading}
                onClick={handleRefresh}
                class="size-7"
              />
            </div>
          </div>
        </div>
      </div>

      <Show
        when={stats()}
        fallback={
          <Show
            when={isMarketDataLoading()}
            fallback={
              <Card class="mb-6">
                <CardContent>
                  <EmptyState
                    title="暂无市场数据"
                    description="该物品在当前范围内没有挂单与成交记录，可尝试切换更大的数据范围"
                  />
                </CardContent>
              </Card>
            }
          >
            <Card class="mb-6">
              <CardContent class="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-0 sm:divide-x sm:divide-border">
                <div class="min-w-0 flex-1 space-y-3 sm:pr-6">
                  <Skeleton class="h-3 w-28 px-2" />
                  <For each={Array.from({ length: 2 })}>
                    {() => (
                      <div class="flex items-center gap-3 px-2">
                        <Skeleton class="h-5 w-8" />
                        <Skeleton class="h-8 w-24" />
                        <Skeleton class="h-1.5 flex-1" />
                      </div>
                    )}
                  </For>
                </div>
                <div class="flex shrink-0 gap-8 sm:flex-col sm:gap-3 sm:pl-6">
                  <div class="space-y-1.5"><Skeleton class="h-3 w-14" /><Skeleton class="h-5 w-20" /></div>
                  <div class="space-y-1.5"><Skeleton class="h-3 w-14" /><Skeleton class="h-5 w-16" /></div>
                </div>
              </CardContent>
            </Card>
          </Show>
        }
      >
        <Card class="mb-6">
          <CardContent class="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-0 sm:divide-x sm:divide-border">
            {/* 最低挂单 + 价格分布：每个品质一行，双品质时整行可点击选择 */}
            <div class="min-w-0 flex-1 sm:pr-6">
              <Show
                when={stats()?.nqDist || stats()?.hqDist}
                fallback={<div class="text-muted-foreground">-</div>}
              >
                <div class="mb-1 px-2 text-xs font-medium text-muted-foreground">
                  最低挂单 · 价格分布
                </div>
                <div class="space-y-1">
                  <Show when={stats()?.nqDist}>
                    {(dist) => (
                      <QualityRow
                        hq={false}
                        dist={dist()}
                        minListing={stats()!.nqMinListing}
                        selectable={bothQualities()}
                      />
                    )}
                  </Show>
                  <Show when={stats()?.hqDist}>
                    {(dist) => (
                      <QualityRow
                        hq
                        dist={dist()}
                        minListing={stats()!.hqMinListing}
                        selectable={bothQualities()}
                      />
                    )}
                  </Show>
                </div>
              </Show>
            </div>

            {/* 日销量 + 挂单数（次要信息） */}
            <div class="flex shrink-0 gap-8 sm:flex-col sm:gap-3 sm:pl-6">
              <div>
                <div class="text-xs font-medium text-muted-foreground">日销量</div>
                <div class="mt-1 space-y-1 text-sm tabular-nums">
                  <Show when={stats()?.nqVelocity != null && stats()!.nqVelocity > 0}>
                    <div class={'flex items-center gap-1.5 ' + (bothQualities() ? qualityRowClass('nq') : '')}>
                      <QualityBadge hq={false} />
                      <span class="font-medium">{formatDailySales(stats()!.nqVelocity)}</span>
                    </div>
                  </Show>
                  <Show when={stats()?.hqVelocity != null && stats()!.hqVelocity > 0}>
                    <div class={'flex items-center gap-1.5 ' + (bothQualities() ? qualityRowClass('hq') : '')}>
                      <QualityBadge hq />
                      <span class="font-medium">{formatDailySales(stats()!.hqVelocity)}</span>
                    </div>
                  </Show>
                  <Show when={(stats()?.nqVelocity ?? 0) === 0 && (stats()?.hqVelocity ?? 0) === 0}>
                    {/* 已加载但销量为 0（非加载中），用 tooltip 说明避免歧义 */}
                    <Tooltip>
                      <TooltipTrigger class="text-muted-foreground cursor-default" aria-label="近期无成交记录">
                        -
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent>近期无成交记录</TooltipContent>
                      </TooltipPortal>
                    </Tooltip>
                  </Show>
                </div>
              </div>
              <div>
                <div class="text-xs font-medium text-muted-foreground">挂单数</div>
                <div class="mt-1 flex items-baseline gap-2">
                  <span class="text-sm font-semibold tabular-nums">
                    {stats()?.listingCount.toLocaleString('zh-CN')}
                  </span>
                  <Show when={stats()?.lastUploadTime}>
                    <span class="text-xs text-muted-foreground">
                      {formatTime(stats()?.lastUploadTime ?? 0)}更新
                    </span>
                  </Show>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Show>

      <Show when={!showMarketSkeleton()} fallback={<ListingChartSkeleton />}>
        <Show when={filteredListings().length > 0}>
          <Card class="mb-6 py-3">
            <CardHeader class="pb-2">
              <CardTitle class="text-sm">挂单价格分布</CardTitle>
              <CardDescription class="text-xs">各服务器挂单价格可视化</CardDescription>
            </CardHeader>
            <CardContent class="pt-0">
              <Tabs value={listingChartTab()} onChange={setListingChartTab}>
                <TabsList class="mb-4">
                  <TabsTrigger value="bar">条形图</TabsTrigger>
                  <TabsTrigger value="violin">小提琴图</TabsTrigger>
                </TabsList>
                <TabsContent value="bar">
                  <ServerListingBarChart listings={filteredListings()} history={filteredHistory()} scope={scope()} historyLoading={showHistorySkeleton()} />
                </TabsContent>
                <TabsContent value="violin">
                  <ServerListingViolin listings={filteredListings()} scope={scope()} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </Show>
      </Show>

      <Show when={filteredHistory().length > 0 || showHistorySkeleton()}>
        <Show when={filteredHistory().length > 0} fallback={<ListingChartSkeleton />}>
          <Card class="mb-6 py-3">
            <CardHeader class="pb-2">
              <CardTitle class="text-sm">交易走势</CardTitle>
              <CardDescription class="text-xs">按服务器拆分的成交记录可视化</CardDescription>
            </CardHeader>
            <CardContent class="pt-0">
              <Tabs value={historyChartTab()} onChange={setHistoryChartTab}>
                <TabsList class="mb-4">
                  <TabsTrigger value="line">走势</TabsTrigger>
                  <TabsTrigger value="scatter">散点</TabsTrigger>
                </TabsList>
                <TabsContent value="line">
                  <ServerHistoryTrendChart history={filteredHistory()} />
                </TabsContent>
                <TabsContent value="scatter">
                  <ServerHistoryScatterChart history={filteredHistory()} scope={scope()} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </Show>
      </Show>

      <div>
        <Tabs value={activeTab()} onChange={setActiveTab}>
          <TabsList class="mb-4">
            <TabsTrigger value="listings">当前挂单</TabsTrigger>
            <TabsTrigger value="history">成交历史</TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            <Card class="py-3">
              <CardHeader class="pb-2">
                <CardTitle class="text-sm">当前挂单</CardTitle>
                <CardDescription class="text-xs">
                  <Show when={!showMarketSkeleton()} fallback="正在加载挂单数据">
                    共 {filteredListings().length} 个挂单
                  </Show>
                </CardDescription>
              </CardHeader>
              <CardContent class="pt-0">
                <Show when={!showMarketSkeleton()} fallback={<ListingTableSkeleton />}>
                  <Show
                    when={filteredListings().length > 0}
                    fallback={
                      <EmptyState
                        title="暂无挂单数据"
                        description="该物品在当前区域暂无挂单信息"
                      />
                    }
                  >
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>品质</TableHead>
                          <TableHead>单价</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>总价</TableHead>
                          <TableHead>服务器</TableHead>
                          <TableHead>雇员</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={filteredListings().slice(0, 50)}>
                          {(listing) => (
                            <TableRow>
                              <TableCell>
                                <QualityBadge hq={listing.hq} />
                              </TableCell>
                              <TableCell class="font-medium">
                                {formatGil(listing.pricePerUnit)} Gil
                              </TableCell>
                              <TableCell>{listing.quantity}</TableCell>
                              <TableCell class="font-medium">
                                {formatGil(listing.total)} Gil
                              </TableCell>
                              <TableCell class="text-muted-foreground">
                                <WorldBadge worldName={listing.worldName || scope()} />
                              </TableCell>
                              <TableCell class="text-muted-foreground">
                                {listing.retainerName}
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </Show>
                </Show>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card class="py-3">
              <CardHeader class="pb-2">
                <CardTitle class="text-sm">成交历史</CardTitle>
                <CardDescription class="text-xs">
                  <Show when={!showHistorySkeleton()} fallback="正在加载成交记录">
                    近期 {filteredHistory().length} 笔成交记录
                  </Show>
                </CardDescription>
              </CardHeader>
              <CardContent class="pt-0">
                <Suspense fallback={<Skeleton class="h-[400px]" />}>
                  <Show
                    when={filteredHistory().length > 0}
                    fallback={
                      <Show
                        when={!showHistorySkeleton()}
                        fallback={<Skeleton class="h-[400px]" />}
                      >
                        <EmptyState
                          title="暂无历史数据"
                          description="该物品在当前区域暂无历史成交记录"
                        />
                      </Show>
                    }
                  >
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>品质</TableHead>
                          <TableHead>单价</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>总价</TableHead>
                          <TableHead>买家</TableHead>
                          <Show when={showHistoryWorld()}>
                            <TableHead>服务器</TableHead>
                          </Show>
                          <TableHead>时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={filteredHistory().slice(0, 30)}>
                          {(sale) => (
                            <TableRow>
                              <TableCell>
                                <QualityBadge hq={sale.hq} />
                              </TableCell>
                              <TableCell class="font-medium">
                                {formatGil(sale.pricePerUnit)} Gil
                              </TableCell>
                              <TableCell>{sale.quantity}</TableCell>
                              <TableCell class="font-medium">
                                {formatGil(sale.total)} Gil
                              </TableCell>
                              <TableCell class="text-muted-foreground">
                                {sale.buyerName || '-'}
                              </TableCell>
                              <Show when={showHistoryWorld()}>
                                <TableCell class="text-muted-foreground">
                                  <WorldBadge worldName={sale.worldName} />
                                </TableCell>
                              </Show>
                              <TableCell class="text-muted-foreground text-xs">
                                {new Date(sale.timestamp * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </Show>
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
