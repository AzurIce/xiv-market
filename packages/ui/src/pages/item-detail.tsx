import { createResource, createMemo, createSignal, createEffect, Show, Suspense, For, on, onMount, onCleanup } from 'solid-js'
import { useParams, A } from '@solidjs/router'
import Chart from 'chart.js/auto'
import { ViolinController, Violin } from '@sgratzl/chartjs-chart-boxplot'
import { fetchMarketData, fetchHistoryData, selectedRegion, getItemName, getItemIconUrl, getDcNameByWorldName } from '@xiv-market/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../card'
import { Badge } from '../badge'
import { Skeleton } from '../skeleton'
import { Table, TableBody, TableRow, TableHead, TableCell, TableHeader } from '../table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'
import { StatCard } from '../stat-card'
import { EmptyState } from '../empty-state'
import { ScopeSelect } from '../scope-select'

Chart.register(ViolinController, Violin)

function formatGil(v: number): string {
  return v.toLocaleString('zh-CN')
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

function PriceDiff(props: { nq?: number; hq?: number; label: string }) {
  const hasNq = createMemo(() => props.nq != null && props.nq! > 0)
  const hasHq = createMemo(() => props.hq != null && props.hq! > 0)
  const both = () => hasNq() && hasHq()
  const onlyNq = () => hasNq() && !hasHq()

  return (
    <div class="flex flex-col">
      <span class="text-xs text-muted-foreground">{props.label}</span>
      <div class="flex flex-col leading-snug">
        <Show when={hasNq()}>
          <span class={(both() || onlyNq()) ? 'font-medium' : 'text-muted-foreground text-xs'}>
            <Show when={both()}><span class="text-xs opacity-60 mr-1">NQ</span></Show>
            {formatGil(props.nq!)}
            <span class="text-xs opacity-60 ml-0.5">Gil</span>
          </span>
        </Show>
        <Show when={hasHq()}>
          <span class={both() ? 'font-medium' : ''}>
            <Show when={both()}><span class="text-xs opacity-60 mr-1">HQ</span></Show>
            {formatGil(props.hq!)}
            <span class="text-xs opacity-60 ml-0.5">Gil</span>
          </span>
        </Show>
        <Show when={!hasNq() && !hasHq()}>
          <span class="text-muted-foreground">-</span>
        </Show>
      </div>
    </div>
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
  prices: number[],
  shouldFilter: boolean
) {
  const filtered = shouldFilter ? filterOutliers(prices) : prices
  const sorted = [...filtered].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const p25 = sorted[Math.floor(sorted.length * 0.25)]
  const p75 = sorted[Math.floor(sorted.length * 0.75)]
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return { server, dc: getDcNameByWorldName(server) || '未知', min, max, p25, p75, median, count: filtered.length }
}

function ServerListingViolin(props: { listings: any[] }) {
  let canvasRef!: HTMLCanvasElement

  createEffect(() => {
    if (!canvasRef || !props.listings?.length) return

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

    // 按 DC 分组并分配颜色
    const dcColors = [
      { bg: 'rgba(59, 130, 246, 0.5)', border: 'rgb(59, 130, 246)' },    // blue
      { bg: 'rgba(234, 179, 8, 0.5)', border: 'rgb(234, 179, 8)' },      // yellow
      { bg: 'rgba(16, 185, 129, 0.5)', border: 'rgb(16, 185, 129)' },    // green
      { bg: 'rgba(239, 68, 68, 0.5)', border: 'rgb(239, 68, 68)' },      // red
      { bg: 'rgba(139, 92, 246, 0.5)', border: 'rgb(139, 92, 246)' },    // purple
      { bg: 'rgba(236, 72, 153, 0.5)', border: 'rgb(236, 72, 153)' },    // pink
      { bg: 'rgba(20, 184, 166, 0.5)', border: 'rgb(20, 184, 166)' },    // teal
      { bg: 'rgba(245, 158, 11, 0.5)', border: 'rgb(245, 158, 11)' },    // orange
    ]
    const dcColorMap = new Map<string, typeof dcColors[0]>()
    let colorIdx = 0
    const serverDcs = servers.map((s) => getDcNameByWorldName(s) || '未知')
    for (const dc of serverDcs) {
      if (!dcColorMap.has(dc)) {
        dcColorMap.set(dc, dcColors[colorIdx % dcColors.length])
        colorIdx++
      }
    }
    const bgColors = servers.map((s) => dcColorMap.get(getDcNameByWorldName(s) || '未知')!.bg)
    const borderColors = servers.map((s) => dcColorMap.get(getDcNameByWorldName(s) || '未知')!.border)

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
          legend: { display: false },
          tooltip: {
            backgroundColor: 'oklch(1 0 0)',
            titleColor: 'oklch(0.145 0 0)',
            bodyColor: 'oklch(0.145 0 0)',
            borderColor: 'oklch(0.922 0 0)',
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
    <div class="h-[320px] w-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

function ServerListingBarChart(props: { listings: any[] }) {
  const [hideOutliers, setHideOutliers] = createSignal(true)

  const serverData = createMemo(() => {
    const listings = props.listings
    if (!listings?.length) return { data: [] as ReturnType<typeof computeStats>[], globalMax: 0 }

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

    const data = servers.map((server) => computeStats(server, byServer[server], hideOutliers()))
    const globalMax = data.length > 0 ? Math.max(...data.map((d) => d.max)) : 0
    return { data, globalMax }
  })

  const dcColorMap = createMemo(() => {
    const colors = [
      { solid: '#22d3ee' },
      { solid: '#a78bfa' },
      { solid: '#fbbf24' },
      { solid: '#34d399' },
    ]
    const map = new Map<string, typeof colors[0]>()
    const data = serverData().data
    let idx = 0
    for (const d of data) {
      if (!map.has(d.dc)) {
        map.set(d.dc, colors[idx % colors.length])
        idx++
      }
    }
    return map
  })

  return (
    <div>
      <div class="flex items-center justify-end mb-3">
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <span class="text-xs text-muted-foreground">隐藏异常高价</span>
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

      <div class="flex items-center gap-3 text-[11px] text-muted-foreground mb-1 px-0.5">
        <span class="w-16 text-right tabular-nums">最低价</span>
        <span class="w-16 text-right tabular-nums">中位价</span>
        <span class="w-24 text-right tabular-nums">P25~P75</span>
        <span class="w-16 text-right">服务器</span>
        <div class="flex-1"></div>
      </div>
      <div class="space-y-1">
        <For each={serverData().data}>
          {(item) => {
            const max = serverData().globalMax
            const listingPct = max > 0 ? (item.min / max) * 100 : 0
            const p25Pct = max > 0 ? (item.p25 / max) * 100 : 0
            const p75Pct = max > 0 ? (item.p75 / max) * 100 : 0
            const medianPct = max > 0 ? (item.median / max) * 100 : 0
            const rangeW = p75Pct - p25Pct
            const color = dcColorMap().get(item.dc)

            return (
              <div
                class="flex items-center gap-3 text-xs group cursor-pointer hover:bg-accent/5 rounded px-0.5 py-0.5 -mx-0.5 transition-colors"
              >
                <span class="w-16 text-right tabular-nums text-[11px] text-muted-foreground">
                  {formatGil(item.min)}
                </span>
                <span class="w-16 text-right tabular-nums text-[11px]" style={{ color: '#fbbf24' }}>
                  {formatGil(item.median)}
                </span>
                <span class="w-24 text-right tabular-nums text-[11px] text-muted-foreground">
                  {formatGil(item.p25)}~{formatGil(item.p75)}
                </span>
                <span class="w-16 text-muted-foreground truncate text-right text-[11px]" title={item.server}>
                  {item.server}
                </span>
                <div class="flex-1 h-4 bg-muted/30 rounded-sm relative overflow-hidden">
                  {/* P25~P75 区间 */}
                  <div
                    class="absolute h-full rounded-sm"
                    style={{
                      left: `${p25Pct}%`,
                      width: `${Math.max(rangeW, 0.5)}%`,
                      background: color ? `${color.solid}33` : 'rgba(156, 163, 175, 0.2)',
                      border: `1px solid ${color ? color.solid + '66' : 'rgba(156, 163, 175, 0.4)'}`,
                    }}
                  />
                  {/* 最低挂单条 */}
                  <div
                    class="absolute h-full rounded-l-sm"
                    style={{
                      width: `${listingPct}%`,
                      'background-color': color ? `${color.solid}cc` : 'rgba(99, 102, 241, 0.8)',
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
              </div>
            )
          }}
        </For>
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
            backgroundColor: 'oklch(1 0 0)',
            titleColor: 'oklch(0.145 0 0)',
            bodyColor: 'oklch(0.145 0 0)',
            borderColor: 'oklch(0.922 0 0)',
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
    <div class="h-[320px] w-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

function ServerHistoryScatterChart(props: { history: any[] }) {
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

    const dcColorValues: Record<string, string> = {
      '陆行鸟': '#22d3ee',
      '莫古力': '#a78bfa',
      '猫小胖': '#fbbf24',
      '豆豆柴': '#34d399',
    }

    const allPrices = filtered.map(h => h.pricePerUnit)
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0

    // Detect multi-world
    const uniqueWorlds = new Set(filtered.map(h => h.worldName).filter(Boolean))
    const isMultiWorld = uniqueWorlds.size > 1

    let datasets: any[]

    if (isMultiWorld) {
      const byDc: Record<string, any[]> = {}
      const DC_NAMES = ['陆行鸟', '莫古力', '猫小胖', '豆豆柴']
      for (const name of DC_NAMES) byDc[name] = []

      for (const h of filtered) {
        const dc = getDcNameByWorldName(h.worldName) || ''
        if (byDc[dc]) {
          byDc[dc].push({
            x: h.timestamp * 1000,
            y: h.pricePerUnit,
            qty: h.quantity,
            world: h.worldName,
          })
        }
      }

      datasets = DC_NAMES.map(name => ({
        label: name,
        data: byDc[name],
        pointRadius: (ctx: any) => {
          const qty = ctx.raw?.qty ?? 1
          return Math.min(20, Math.max(6, qty * 2))
        },
        pointBackgroundColor: (dcColorValues[name] || '#9ca3af') + '80',
        pointBorderColor: 'transparent',
      }))
    } else {
      const hqData = filtered.filter(h => h.hq).map(h => ({
        x: h.timestamp * 1000,
        y: h.pricePerUnit,
        qty: h.quantity,
      }))
      const nqData = filtered.filter(h => !h.hq).map(h => ({
        x: h.timestamp * 1000,
        y: h.pricePerUnit,
        qty: h.quantity,
      }))

      datasets = [
        {
          label: 'HQ',
          data: hqData,
          pointRadius: (ctx: any) => Math.min(20, Math.max(6, (ctx.raw?.qty ?? 1) * 2)),
          pointBackgroundColor: '#22d3ee80',
          pointBorderColor: 'transparent',
        },
        {
          label: 'NQ',
          data: nqData,
          pointRadius: (ctx: any) => Math.min(20, Math.max(6, (ctx.raw?.qty ?? 1) * 2)),
          pointBackgroundColor: '#a78bfa80',
          pointBorderColor: 'transparent',
        },
      ]
    }

    const chart = new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            backgroundColor: 'oklch(1 0 0)',
            titleColor: 'oklch(0.145 0 0)',
            bodyColor: 'oklch(0.145 0 0)',
            borderColor: 'oklch(0.922 0 0)',
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
    <div class="h-[300px] w-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

export default function ItemDetail() {
  const params = useParams()
  const itemId = createMemo(() => params.id)
  const [activeTab, setActiveTab] = createSignal('listings')
  const [listingChartTab, setListingChartTab] = createSignal('bar')
  const [historyChartTab, setHistoryChartTab] = createSignal('line')
  const [copied, setCopied] = createSignal(false)
  const [scope, setScope] = createSignal(selectedRegion())
  const [isScrolled, setIsScrolled] = createSignal(false)

  createEffect(on(selectedRegion, (region) => {
    setScope(region)
  }))

  onMount(() => {
    // 使用迟滞阈值避免临界点振荡（抽搐）
    const handleScroll = () => {
      const y = window.scrollY
      if (y > 80) setIsScrolled(true)
      else if (y < 40) setIsScrolled(false)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    onCleanup(() => window.removeEventListener('scroll', handleScroll))
  })

  const [marketDataMap] = createResource(
    () => {
      const id = itemId()
      if (!id) return null
      return { scope: scope(), id }
    },
    ({ scope: s, id }: { scope: string; id: string }) => fetchMarketData(s, id)
  )

  const [historyData] = createResource(
    () => {
      const id = itemId()
      if (!id) return null
      return { scope: scope(), id }
    },
    ({ scope: s, id }: { scope: string; id: string }) => fetchHistoryData(s, id)
  )

  const marketData = createMemo(() => {
    const map = marketDataMap()
    if (!map) return null
    const id = Number(itemId())
    return map[id] ?? null
  })

  const currentListings = createMemo(() => marketData()?.listings ?? [])
  const history = createMemo(() => historyData()?.entries ?? [])

  const stats = createMemo(() => {
    const data = marketData()
    if (!data) return null
    return {
      avgPriceNQ: data.currentAveragePriceNQ,
      avgPriceHQ: data.currentAveragePriceHQ,
      minPriceNQ: data.minPriceNQ,
      minPriceHQ: data.minPriceHQ,
      maxPriceNQ: data.maxPriceNQ,
      maxPriceHQ: data.maxPriceHQ,
      velocity: data.regularSaleVelocity,
      nqVelocity: data.nqSaleVelocity,
      hqVelocity: data.hqSaleVelocity,
      lastUploadTime: data.lastUploadTime,
      listingCount: data.listings?.length ?? 0,
    }
  })

  const handleCopyName = () => {
    const name = getItemName(Number(itemId()))
    navigator.clipboard.writeText(name).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Sticky Header */}
      <div
        class={
          'sticky top-14 z-40 rounded-xl -mx-2 px-2 transition-[background-color,border-color,box-shadow,padding] duration-300 ' +
          (isScrolled()
            ? 'bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm py-2'
            : 'bg-transparent py-4 mb-8')
        }
      >
        {/* 统一的单行布局 */}
        <div class="flex items-center gap-3">
          {/* 返回按钮 */}
          <A
            href="/"
            class="flex-shrink-0 rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-300 h-8 w-8"
            title="返回市场"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </A>

          {/* 物品图标 */}
          <Show when={getItemIconUrl(Number(itemId()))}>
            <img
              src={getItemIconUrl(Number(itemId()))!}
              alt=""
              class={
                'rounded flex-shrink-0 transition-all duration-300 ' +
                (isScrolled() ? 'h-6 w-6' : 'h-10 w-10')
              }
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </Show>

          {/* 物品信息 */}
          <div class="min-w-0 flex-1">
            {/* 主行：名称 + 复制 + 右侧信息 */}
            <div class="flex items-center gap-2">
              <h1
                class={
                  'font-bold tracking-tight truncate transition-all duration-300 ' +
                  (isScrolled() ? 'text-lg' : 'text-3xl')
                }
              >
                {getItemName(Number(itemId()))}
              </h1>

              {/* 复制按钮 */}
              <button
                onClick={handleCopyName}
                class="rounded-md hover:bg-accent/50 transition-colors flex-shrink-0 h-5 w-5 p-0.5"
                title={copied() ? '已复制' : '复制名称'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full text-muted-foreground">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </button>

              {/* flex-1  spacer */}
              <div class="flex-1" />

              {/* 更新时间 - 收缩时隐藏 */}
              <div
                class={
                  'hidden sm:block overflow-hidden transition-all duration-300 whitespace-nowrap ' +
                  (isScrolled() ? 'w-0 opacity-0' : 'w-auto opacity-100')
                }
              >
                <Show when={stats()?.lastUploadTime}>
                  <p class="text-sm text-muted-foreground">
                    更新于 {formatTime(stats()?.lastUploadTime ?? 0)}
                  </p>
                </Show>
              </div>

              {/* 数据范围选择器 */}
              <div class="flex-shrink-0">
                <ScopeSelect value={scope()} onChange={setScope} region={selectedRegion()} />
              </div>
            </div>

            {/* 副行：ID + DC - 收缩时隐藏 */}
            <div
              class={
                'flex items-center gap-2 overflow-hidden transition-all duration-300 ' +
                (isScrolled() ? 'h-0 opacity-0 mt-0' : 'h-5 opacity-100 mt-1')
              }
            >
              <span class="text-sm text-muted-foreground">#{itemId()}</span>
              <Badge variant="outline">{scope()}</Badge>
            </div>
          </div>
        </div>
      </div>

      <Show
        when={stats()}
        fallback={
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <For each={Array.from({ length: 4 })}>
              {() => <Card><CardHeader class="pb-2"><Skeleton class="h-4 w-20" /></CardHeader><CardContent><Skeleton class="h-8 w-24" /></CardContent></Card>}
            </For>
          </div>
        }
      >
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="最低挂单"
            icon={
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17 5 7h2l3 10" /><path d="M3.5 14h7" /><path d="M14 7h4" /><path d="M16 7v10" /></svg>
            }
          >
            <PriceDiff nq={stats()?.minPriceNQ} hq={stats()?.minPriceHQ} label="" />
          </StatCard>
          <StatCard
            title="平均价格"
            icon={
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
            }
          >
            <PriceDiff nq={stats()?.avgPriceNQ} hq={stats()?.avgPriceHQ} label="" />
          </StatCard>
          <StatCard title="最高价格">
            <PriceDiff nq={stats()?.maxPriceNQ} hq={stats()?.maxPriceHQ} label="" />
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
            <p class="text-xs text-muted-foreground mt-1">共 {stats()?.listingCount} 个挂单</p>
          </StatCard>
        </div>
      </Show>

      <Show when={currentListings().length > 0}>
        <Card class="mb-6">
          <CardHeader>
            <CardTitle>挂单价格分布</CardTitle>
            <CardDescription>各服务器挂单价格可视化</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={listingChartTab()} onChange={setListingChartTab}>
              <TabsList class="mb-4">
                <TabsTrigger value="bar">条形图</TabsTrigger>
                <TabsTrigger value="violin">小提琴图</TabsTrigger>
              </TabsList>
              <TabsContent value="bar">
                <ServerListingBarChart listings={currentListings()} />
              </TabsContent>
              <TabsContent value="violin">
                <ServerListingViolin listings={currentListings()} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </Show>

      <Show when={history().length > 0}>
        <Card class="mb-6">
          <CardHeader>
            <CardTitle>交易走势</CardTitle>
            <CardDescription>按服务器拆分的成交记录可视化</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={historyChartTab()} onChange={setHistoryChartTab}>
              <TabsList class="mb-4">
                <TabsTrigger value="line">走势</TabsTrigger>
                <TabsTrigger value="scatter">散点</TabsTrigger>
              </TabsList>
              <TabsContent value="line">
                <ServerHistoryTrendChart history={history()} />
              </TabsContent>
              <TabsContent value="scatter">
                <ServerHistoryScatterChart history={history()} />
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
            <Card>
              <CardHeader>
                <CardTitle>当前挂单</CardTitle>
                <CardDescription>共 {currentListings().length} 个挂单</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton class="h-[300px]" />}>
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
                          <TableHead class="hidden sm:table-cell">服务器</TableHead>
                          <TableHead class="hidden md:table-cell">雇员</TableHead>
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
                              <TableCell class="hidden sm:table-cell text-muted-foreground">
                                {listing.worldName || scope()}
                              </TableCell>
                              <TableCell class="hidden md:table-cell text-muted-foreground">
                                {listing.retainerName}
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

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>成交历史</CardTitle>
                <CardDescription>近期 {history().length} 笔成交记录</CardDescription>
              </CardHeader>
              <CardContent>
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
                          <TableHead class="hidden sm:table-cell">时间</TableHead>
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
                              <TableCell class="hidden sm:table-cell text-muted-foreground text-xs">
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
