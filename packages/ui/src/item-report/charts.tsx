import { createMemo, createSignal, createEffect, Show, For, onCleanup } from 'solid-js'
import { getDcColorHex, type WorldDirectory } from '@xiv-market/shared'
import { Card, CardContent, CardHeader } from '../card'
import { Button } from '../button'
import { Skeleton } from '../skeleton'
import { EmptyState } from '../empty-state'
import { RefreshButton } from '../refresh-button'
import { Tooltip, TooltipPortal, TooltipTrigger, TooltipContent } from '../tooltip'
import { formatGil, formatAxisGil, formatDailySales, formatTime } from './format'

type ChartConstructor = typeof import('chart.js/auto').default

let chartPromise: Promise<ChartConstructor> | null = null
let violinPluginPromise: Promise<void> | null = null

async function loadChart(registerViolin = false): Promise<ChartConstructor> {
  try {
    chartPromise ??= import('chart.js/auto').then((mod) => mod.default)
    const Chart = await chartPromise

    if (registerViolin) {
      violinPluginPromise ??= import('@sgratzl/chartjs-chart-boxplot').then((mod) => {
        Chart.register(mod.ViolinController, mod.Violin)
      })
      await violinPluginPromise
    }

    return Chart
  } catch (e) {
    // 加载失败时重置缓存的 promise，下次调用可重试
    // （否则 rejected promise 被永久复用，图表永远无法自愈）
    chartPromise = null
    violinPluginPromise = null
    throw e
  }
}

function createChartHelpers(directory: () => WorldDirectory) {
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
    if (directory().dataCenters.some((dc) => dc.region === scope)) return 'region'
    if (directory().dataCenters.some((dc) => dc.name === scope)) return 'dc'
    return 'world'
  }

  function getWorldNamesInDc(dcName: string): string[] {
    const dc = directory().dataCenters.find((d) => d.name === dcName)
    if (!dc) return []
    return dc.worlds
      .map((worldId) => directory().worldName(worldId))
      .filter((name): name is string => Boolean(name))
  }

  function getChartGroupName(scope: string, worldName: string | undefined): string {
    const kind = getScopeKind(scope)
    if (kind === 'region') return directory().dcNameByWorldName(worldName || '') || '未知'
    if (kind === 'dc') return worldName || '未知服务器'
    return worldName || scope
  }

  function getChartGroupOrder(scope: string, presentGroups: string[]): string[] {
    const present = new Set(presentGroups)
    const kind = getScopeKind(scope)

    if (kind === 'region') {
      const regionDcs = directory().dataCenters.filter((dc) => dc.region === scope).map((dc) => dc.name)
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
    return getDcColor(directory().dcNameByWorldName(groupName))
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
        dc: directory().dcNameByWorldName(server) || '未知',
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
      dc: directory().dcNameByWorldName(server) || '未知',
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


  return { getScopeKind, getChartGroupName, getChartGroupOrder, getChartGroupColor, computeStats, filterOutliers, getDcNameByWorldName: (name: string) => directory().dcNameByWorldName(name) }
}

export function ListingTableSkeleton() {
  return (
    <div class="space-y-2" role="status">
      <span class="sr-only">加载中</span>
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

export function ListingChartSkeleton() {
  return (
    <Card class="mb-6 py-3" role="status">
      <span class="sr-only">加载中</span>
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

// 图表卡片区域的错误屏（无数据时错误的落点）
export function ChartErrorCard(props: { title: string; description?: string; loading: boolean; onRetry: () => void }) {
  return (
    <Card class="mb-6 py-3">
      <CardContent class="pt-0">
        <EmptyState
          variant="error"
          title={props.title}
          description={props.description}
          action={<RefreshButton loading={props.loading} onClick={props.onRetry} />}
        />
      </CardContent>
    </Card>
  )
}

// chart.js 动态 import 失败时的图内错误行（图表代码包加载失败，与数据无关）
function ChartLoadError(props: { onRetry: () => void }) {
  return (
    <div class="flex h-[240px] sm:h-[320px] w-full flex-col items-center justify-center gap-2" role="alert" data-chart-state="error">
      <p class="text-sm text-muted-foreground">图表加载失败</p>
      <Button variant="link" size="sm" class="h-auto p-0" onClick={props.onRetry}>
        重试
      </Button>
    </div>
  )
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

export function ServerListingViolin(props: { directory: WorldDirectory; listings: any[]; scope: string; animate?: boolean }) {
  const { getScopeKind, getChartGroupName, getChartGroupOrder, getChartGroupColor, filterOutliers, getDcNameByWorldName } = createChartHelpers(() => props.directory)
  let canvasRef!: HTMLCanvasElement
  const [loadError, setLoadError] = createSignal(false)
  const [renderState, setRenderState] = createSignal('loading')

  createEffect(() => {
    const listings = props.listings
    const scope = props.scope
    if (loadError()) return
    if (!canvasRef || !listings?.length) return
    const animate = props.animate !== false
    setRenderState('loading')

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
      if (!ctx) throw new Error('Canvas 2D context is unavailable')

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
        plugins: [{ id: 'report-readiness', afterRender: () => { if (!disposed) setRenderState('ready') } }],
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
          animation: animate ? undefined : false,
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
    }).catch(() => {
      if (!disposed) { setRenderState('error'); setLoadError(true) }
    })
  })

  return (
    <Show when={!loadError()} fallback={<ChartLoadError onRetry={() => setLoadError(false)} />}>
      <div class="h-[240px] sm:h-[320px] w-full" role="img" aria-label="服务器挂单价格小提琴图">
        <canvas ref={canvasRef} aria-hidden="true" data-chart-state={renderState()} />
      </div>
    </Show>
  )
}

export function ServerListingBarChart(props: { directory: WorldDirectory; listings: any[]; history: any[]; scope: string; historyLoading: boolean; historyError?: boolean }) {
  const { getChartGroupName, getChartGroupOrder, getChartGroupColor, computeStats, filterOutliers, getDcNameByWorldName } = createChartHelpers(() => props.directory)
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
                  title={
                    props.historyLoading
                      ? undefined
                      : props.historyError
                        ? '成交历史加载失败'
                        : `最近 7 天 ${formatDailySales(item.dailySales)}，前 7 天 ${formatDailySales(item.previousDailySales)}`
                  }
                >
                  {/* 销量由 history 接口计算：加载中显示骨架（"-" 会被误读为无数据）；
                      无数据且失败显示 "-" 并以 title 说明；有旧数据时刷新失败仍显示旧值（错误走 toast） */}
                  <Show when={!props.historyLoading} fallback={<Skeleton class="h-3 w-10" />}>
                    <Show when={!props.historyError} fallback={<span>-</span>}>
                      <span>{formatDailySales(item.dailySales)}</span>
                      <SalesTrendIcon trend={item.salesTrend} />
                    </Show>
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

export function ServerHistoryTrendChart(props: { history: any[]; animate?: boolean }) {
  let canvasRef!: HTMLCanvasElement
  const [loadError, setLoadError] = createSignal(false)
  const [renderState, setRenderState] = createSignal('loading')

  createEffect(() => {
    const data = props.history
    if (loadError()) return
    if (!canvasRef || !data?.length) return
    const animate = props.animate !== false
    setRenderState('loading')

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
      if (!ctx) throw new Error('Canvas 2D context is unavailable')

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
        plugins: [{ id: 'report-readiness', afterRender: () => { if (!disposed) setRenderState('ready') } }],
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
          animation: animate ? undefined : false,
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
    }).catch(() => {
      if (!disposed) { setRenderState('error'); setLoadError(true) }
    })
  })

  return (
    <Show when={!loadError()} fallback={<ChartLoadError onRetry={() => setLoadError(false)} />}>
      <div class="h-[240px] sm:h-[320px] w-full" role="img" aria-label="服务器历史价格走势图">
        <canvas ref={canvasRef} aria-hidden="true" data-chart-state={renderState()} />
      </div>
    </Show>
  )
}

export function ServerHistoryScatterChart(props: { directory: WorldDirectory; history: any[]; scope: string; animate?: boolean }) {
  const { getScopeKind, getChartGroupName, getChartGroupOrder, getChartGroupColor } = createChartHelpers(() => props.directory)
  let canvasRef!: HTMLCanvasElement
  const [loadError, setLoadError] = createSignal(false)
  const [renderState, setRenderState] = createSignal('loading')

  createEffect(() => {
    const data = props.history
    const scope = props.scope
    if (loadError()) return
    if (!canvasRef || !data?.length) return
    const animate = props.animate !== false
    setRenderState('loading')

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
      if (!ctx) throw new Error('Canvas 2D context is unavailable')

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
        plugins: [{ id: 'report-readiness', afterRender: () => { if (!disposed) setRenderState('ready') } }],
        type: 'scatter',
        data: { datasets },
        options: {
          animation: animate ? undefined : false,
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
    }).catch(() => {
      if (!disposed) { setRenderState('error'); setLoadError(true) }
    })
  })

  return (
    <Show when={!loadError()} fallback={<ChartLoadError onRetry={() => setLoadError(false)} />}>
      <div class="h-[240px] sm:h-[300px] w-full" role="img" aria-label="服务器历史成交散点图">
        <canvas ref={canvasRef} aria-hidden="true" data-chart-state={renderState()} />
      </div>
    </Show>
  )
}
