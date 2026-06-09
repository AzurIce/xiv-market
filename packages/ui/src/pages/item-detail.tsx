import { createResource, createMemo, createSignal, createEffect, Show, Suspense, For, on, onMount, onCleanup } from 'solid-js'
import { useParams, A, useSearchParams } from '@solidjs/router'
import Chart from 'chart.js/auto'
import { ViolinController, Violin } from '@sgratzl/chartjs-chart-boxplot'
import { fetchMarketData, fetchHistoryData, selectedRegion, dataCenters, worlds, getItemName, getItemIconUrl, getDcNameByWorldName, baseUrl } from '@xiv-market/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../card'
import { Badge } from '../badge'
import { Skeleton } from '../skeleton'
import { Table, TableBody, TableRow, TableHead, TableCell, TableHeader } from '../table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'
import { StatCard } from '../stat-card'
import { EmptyState } from '../empty-state'
import { ScopeSelect } from '../scope-select'

Chart.register(ViolinController, Violin)

const CHINA_DC_NAMES = ['陆行鸟', '莫古力', '猫小胖', '豆豆柴'] as const
type ChinaDcName = typeof CHINA_DC_NAMES[number]

const DC_COLORS: Record<ChinaDcName, { solid: string; bg: string; point: string }> = {
  '陆行鸟': { solid: '#22d3ee', bg: '#22d3ee80', point: '#22d3ee80' },
  '莫古力': { solid: '#a78bfa', bg: '#a78bfa80', point: '#a78bfa80' },
  '猫小胖': { solid: '#fbbf24', bg: '#fbbf2480', point: '#fbbf2480' },
  '豆豆柴': { solid: '#34d399', bg: '#34d39980', point: '#34d39980' },
}

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
  if (dc && dc in DC_COLORS) return DC_COLORS[dc as ChinaDcName]
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
    .map((worldId) => worlds.find((world) => world.id === worldId)?.name)
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

function ServerListingViolin(props: { listings: any[]; scope: string }) {
  let canvasRef!: HTMLCanvasElement

  createEffect(() => {
    if (!canvasRef) return

    const existing = Chart.getChart(canvasRef)
    if (existing) existing.destroy()

    if (!props.listings?.length) return

    const ctx = canvasRef.getContext('2d')
    if (!ctx) return

    const byServer: Record<string, number[]> = {}
    for (const l of props.listings) {
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
    const serverGroups = servers.map((server) => getChartGroupName(props.scope, server))
    const legendGroups = getChartGroupOrder(props.scope, Array.from(new Set(serverGroups)))
    const bgColors = serverGroups.map((group) => getChartGroupColor(props.scope, group).bg)
    const borderColors = serverGroups.map((group) => getChartGroupColor(props.scope, group).solid)

    // 计算各服务器统计量用于 tooltip
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

    const chart = new Chart(ctx, {
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
            display: getScopeKind(props.scope) !== 'world',
            position: 'top',
            onClick: () => undefined,
            labels: {
              generateLabels: () => legendGroups.map((name, index) => ({
                text: name,
                fillStyle: getChartGroupColor(props.scope, name).bg,
                strokeStyle: getChartGroupColor(props.scope, name).solid,
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

    return () => chart.destroy()
  })

  return (
    <div class="h-[240px] sm:h-[320px] w-full" role="img" aria-label="服务器挂单价格小提琴图">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}

function ServerListingBarChart(props: { listings: any[]; scope: string }) {
  const [hideOutliers, setHideOutliers] = createSignal(true)

  const serverData = createMemo(() => {
    const listings = props.listings
    if (!listings?.length) {
      return {
        data: [] as ReturnType<typeof computeStats>[],
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

    const data = servers.map((server) => computeStats(server, byServer[server], hideOutliers()))
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
      <div class="flex items-center justify-end mb-3">
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <span
            class="text-xs text-muted-foreground"
            title="从统计中移除明显偏高的挂单，影响表格数值和条形范围"
          >
            忽略异常高价
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
        <div class="grid grid-cols-[minmax(4.5rem,auto)_minmax(4.5rem,auto)_minmax(5.5rem,auto)_minmax(3.5rem,auto)_minmax(12rem,1fr)_minmax(3.5rem,auto)_minmax(5rem,auto)] gap-x-2 sm:gap-x-3 gap-y-1 text-xs px-0.5 min-w-[700px]">
        {/* 表头 */}
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">最低价</span>
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">中位价</span>
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">P25~P75</span>
        <span class="text-right whitespace-nowrap text-muted-foreground">服务器</span>
        <Axis position="top" />
        <span class="text-right tabular-nums whitespace-nowrap text-muted-foreground">挂单量</span>
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
      </div>
      </div>
    </div>
  )
}

function ServerHistoryTrendChart(props: { history: any[] }) {
  let canvasRef!: HTMLCanvasElement

  createEffect(() => {
    const data = props.history
    if (!canvasRef) return

    // 销毁可能存在的旧图表
    const existing = Chart.getChart(canvasRef)
    if (existing) existing.destroy()

    if (!data?.length) return
    const ctx = canvasRef.getContext('2d')
    if (!ctx) return

    // 日级聚合（使用本地时间）
    const byDay: Record<string, { prices: number[]; volume: number }> = {}
    for (const h of props.history) {
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

    const chart = new Chart(ctx, {
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

    return () => chart.destroy()
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
    if (!canvasRef) return

    // 销毁可能存在的旧图表
    const existing = Chart.getChart(canvasRef)
    if (existing) existing.destroy()

    if (!data?.length) return
    const ctx = canvasRef.getContext('2d')
    if (!ctx) return

    const now = Date.now()
    const day7Ago = now - 7 * 24 * 60 * 60 * 1000
    const filtered = data.filter(h => h.timestamp * 1000 >= day7Ago)

    const allPrices = filtered.map(h => h.pricePerUnit)
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0

    const scopeKind = getScopeKind(props.scope)
    const byGroup: Record<string, any[]> = {}

    for (const h of filtered) {
      const group = getChartGroupName(props.scope, h.worldName)
      if (!byGroup[group]) byGroup[group] = []
      byGroup[group].push({
        x: h.timestamp * 1000,
        y: h.pricePerUnit,
        qty: h.quantity,
        world: h.worldName,
      })
    }

    const groupNames = getChartGroupOrder(props.scope, Object.keys(byGroup))
    const datasets = groupNames.map(name => ({
      label: name,
      data: byGroup[name],
      pointRadius: (ctx: any) => {
        const qty = ctx.raw?.qty ?? 1
        return Math.min(20, Math.max(6, qty * 2))
      },
      pointBackgroundColor: getChartGroupColor(props.scope, name).point,
      pointBorderColor: 'transparent',
    }))

    if (scopeKind === 'world' && datasets.length === 0) {
      datasets.push({
        label: props.scope,
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
        pointBackgroundColor: getChartGroupColor(props.scope, props.scope).point,
        pointBorderColor: 'transparent',
      })
    }

    const chart = new Chart(ctx, {
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

    return () => chart.destroy()
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

  const [marketDataResult] = createResource(
    () => {
      const id = itemId()
      if (!id) return null
      return { scope: scope(), id }
    },
    async ({ scope: s, id }: { scope: string; id: string }) => ({
      scope: s,
      id,
      data: await fetchMarketData(s, id),
    })
  )

  const [historyDataResult] = createResource(
    () => {
      const id = itemId()
      if (!id) return null
      return { scope: scope(), id }
    },
    async ({ scope: s, id }: { scope: string; id: string }) => ({
      scope: s,
      id,
      data: await fetchHistoryData(s, id),
    })
  )

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
  const showHistoryWorld = createMemo(() =>
    history().some((sale) => Boolean(sale.worldName) && sale.worldName !== scope())
  )

  const stats = createMemo(() => {
    const data = marketData()
    if (!data) return null
    const listings = currentListings()
    const prices = listings
      .map((listing) => Number(listing.pricePerUnit ?? 0))
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((a, b) => a - b)
    const minListing = listings
      .filter((listing) => Number.isFinite(Number(listing.pricePerUnit)) && Number(listing.pricePerUnit) > 0)
      .slice()
      .sort((a, b) => {
        const priceDiff = Number(a.pricePerUnit) - Number(b.pricePerUnit)
        if (priceDiff !== 0) return priceDiff
        return Number(a.total ?? 0) - Number(b.total ?? 0)
      })[0]
    const minListingWorld = minListing?.worldName || ''
    const minListingDc = getDcNameByWorldName(minListingWorld) || ''

    return {
      velocity: data.regularSaleVelocity,
      nqVelocity: data.nqSaleVelocity,
      hqVelocity: data.hqSaleVelocity,
      lastUploadTime: data.lastUploadTime,
      listingCount: listings.length,
      minListing,
      minListingWorld,
      minListingDc,
      p25: percentile(prices, 0.25),
      p50: percentile(prices, 0.5),
      p75: percentile(prices, 0.75),
    }
  })

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
              <button
                onClick={handleCopyName}
                class={
                  'rounded-md hover:bg-accent/80 hover:text-accent-foreground transition-all duration-200 flex items-center justify-center text-muted-foreground ' +
                  (isScrolled() ? 'h-6 w-6' : 'h-7 w-7')
                }
                aria-label={copied() ? '已复制' : '复制名称'}
                title={copied() ? '已复制' : '复制名称'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={isScrolled() ? 'h-3.5 w-3.5' : 'h-4 w-4'}>
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </button>

              {/* 灰机wiki */}
              <a
                href={`https://ff14.huijiwiki.com/wiki/${encodeURIComponent('物品:' + getItemName(Number(itemId())))}`}
                target="_blank"
                rel="noopener noreferrer"
                class={
                  'rounded-md hover:bg-accent/80 hover:opacity-100 opacity-70 transition-all duration-200 flex items-center justify-center overflow-hidden ' +
                  (isScrolled() ? 'h-6 w-6' : 'h-7 w-7')
                }
                title="在灰机wiki查看"
                aria-label="在灰机wiki查看"
              >
                <img src={`${baseUrl()}huiji.webp`} alt="灰机wiki" class={isScrolled() ? 'h-3.5 w-3.5' : 'h-4 w-4'} draggable="false" />
              </a>

              {/* Garland Tools */}
              <a
                href={`https://garlandtools.cn/db/#item/${itemId()}`}
                target="_blank"
                rel="noopener noreferrer"
                class={
                  'rounded-md hover:bg-accent/80 hover:opacity-100 opacity-70 transition-all duration-200 flex items-center justify-center overflow-hidden ' +
                  (isScrolled() ? 'h-6 w-6' : 'h-7 w-7')
                }
                title="在 Garland Tools 查看"
                aria-label="在 Garland Tools 查看"
              >
                <img src={`${baseUrl()}garland.webp`} alt="Garland Tools" class={isScrolled() ? 'h-3.5 w-3.5' : 'h-4 w-4'} draggable="false" />
              </a>
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

            {/* 数据范围选择器 - 桌面端 */}
            <div class="hidden sm:block flex-shrink-0">
              <ScopeSelect value={scope()} onChange={setScope} region={selectedRegion()} />
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
            {/* 移动端 ScopeSelect */}
            <div class="sm:hidden">
              <ScopeSelect value={scope()} onChange={setScope} region={selectedRegion()} />
            </div>
          </div>
        </div>
      </div>

      <Show
        when={stats()}
        fallback={
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <For each={Array.from({ length: 4 })}>
              {() => <Card><CardHeader class="pb-2"><Skeleton class="h-4 w-20" /></CardHeader><CardContent><Skeleton class="h-8 w-24" /></CardContent></Card>}
            </For>
          </div>
        }
      >
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            title="最低挂单"
            icon={
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17 5 7h2l3 10" /><path d="M3.5 14h7" /><path d="M14 7h4" /><path d="M16 7v10" /></svg>
            }
          >
            <Show
              when={stats()?.minListing}
              fallback={<span class="text-muted-foreground">-</span>}
            >
              {(listing) => (
                <div class="space-y-1.5">
                  <div class="flex items-baseline gap-1.5">
                    <span class="text-xl font-semibold tabular-nums">
                      {formatGil(listing().pricePerUnit)}
                    </span>
                    <span class="text-xs text-muted-foreground">Gil</span>
                    <Badge variant={listing().hq ? 'default' : 'secondary'}>
                      {listing().hq ? 'HQ' : 'NQ'}
                    </Badge>
                  </div>
                  <div class="min-w-0 text-xs leading-snug text-muted-foreground">
                    <div class="truncate" title={stats()?.minListingWorld || scope()}>
                      {stats()?.minListingWorld || scope()}
                    </div>
                    <Show when={stats()?.minListingDc}>
                      <div class="truncate" title={stats()?.minListingDc}>
                        {stats()?.minListingDc}
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </StatCard>
          <StatCard
            title="价格分布"
            icon={
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
            }
          >
            <div class="grid grid-cols-3 gap-2">
              <div class="min-w-0">
                <div class="text-[10px] text-muted-foreground">P25</div>
                <div class="text-sm font-medium tabular-nums truncate" title={formatGil(stats()?.p25 ?? 0)}>
                  {stats()?.p25 ? formatAxisGil(stats()!.p25) : '-'}
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] text-muted-foreground">P50</div>
                <div class="text-sm font-semibold text-amber-500 tabular-nums truncate" title={formatGil(stats()?.p50 ?? 0)}>
                  {stats()?.p50 ? formatAxisGil(stats()!.p50) : '-'}
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] text-muted-foreground">P75</div>
                <div class="text-sm font-medium tabular-nums truncate" title={formatGil(stats()?.p75 ?? 0)}>
                  {stats()?.p75 ? formatAxisGil(stats()!.p75) : '-'}
                </div>
              </div>
            </div>
          </StatCard>
          <StatCard title="日销量">
            <div class="flex flex-col leading-snug">
              <Show when={stats()?.nqVelocity != null && stats()!.nqVelocity > 0}>
                <span class="text-muted-foreground text-xs">NQ <span class="font-medium text-foreground">{stats()?.nqVelocity.toFixed(2)}</span> /天</span>
              </Show>
              <Show when={stats()?.hqVelocity != null && stats()!.hqVelocity > 0}>
                <span class="text-xs">HQ <span class="font-medium">{stats()?.hqVelocity.toFixed(2)}</span> /天</span>
              </Show>
              <Show when={(stats()?.nqVelocity ?? 0) === 0 && (stats()?.hqVelocity ?? 0) === 0}>
                <span class="text-muted-foreground">-</span>
              </Show>
            </div>
          </StatCard>
          <StatCard title="挂单概况">
            <div class="flex flex-col leading-snug">
              <span class="text-xl font-semibold tabular-nums">
                {stats()?.listingCount.toLocaleString('zh-CN')}
              </span>
              <span class="text-xs text-muted-foreground">当前范围挂单数</span>
              <Show when={stats()?.lastUploadTime}>
                <span class="text-xs text-muted-foreground mt-1">
                  更新于 {formatTime(stats()?.lastUploadTime ?? 0)}
                </span>
              </Show>
            </div>
          </StatCard>
        </div>
      </Show>

      <Show when={!isMarketDataLoading()} fallback={<ListingChartSkeleton />}>
        <Show when={currentListings().length > 0}>
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
                  <ServerListingBarChart listings={currentListings()} scope={scope()} />
                </TabsContent>
                <TabsContent value="violin">
                  <ServerListingViolin listings={currentListings()} scope={scope()} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </Show>
      </Show>

      <Show when={history().length > 0}>
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
                <ServerHistoryTrendChart history={history()} />
              </TabsContent>
              <TabsContent value="scatter">
                <ServerHistoryScatterChart history={history()} scope={scope()} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
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
                  <Show when={!isMarketDataLoading()} fallback="正在加载挂单数据">
                    共 {currentListings().length} 个挂单
                  </Show>
                </CardDescription>
              </CardHeader>
              <CardContent class="pt-0">
                <Show when={!isMarketDataLoading()} fallback={<ListingTableSkeleton />}>
                  <Show
                    when={currentListings().length > 0}
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
                        <For each={currentListings().slice(0, 50)}>
                          {(listing) => (
                            <TableRow>
                              <TableCell>
                                <Badge variant={listing.hq ? 'default' : 'secondary'}>
                                  {listing.hq ? 'HQ' : 'NQ'}
                                </Badge>
                              </TableCell>
                              <TableCell class="font-medium">
                                {formatGil(listing.pricePerUnit)} Gil
                              </TableCell>
                              <TableCell>{listing.quantity}</TableCell>
                              <TableCell class="font-medium">
                                {formatGil(listing.total)} Gil
                              </TableCell>
                              <TableCell class="text-muted-foreground">
                                {listing.worldName || scope()}
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
                <CardDescription class="text-xs">近期 {history().length} 笔成交记录</CardDescription>
              </CardHeader>
              <CardContent class="pt-0">
                <Suspense fallback={<Skeleton class="h-[400px]" />}>
                  <Show
                    when={history().length > 0}
                    fallback={
                      <EmptyState
                        title="暂无历史数据"
                        description="该物品在当前区域暂无历史成交记录"
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
                          <TableHead>买家</TableHead>
                          <Show when={showHistoryWorld()}>
                            <TableHead>服务器</TableHead>
                          </Show>
                          <TableHead>时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={history().slice(0, 30)}>
                          {(sale) => (
                            <TableRow>
                              <TableCell>
                                <Badge variant={sale.hq ? 'default' : 'secondary'}>
                                  {sale.hq ? 'HQ' : 'NQ'}
                                </Badge>
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
                                  {sale.worldName || '-'}
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
