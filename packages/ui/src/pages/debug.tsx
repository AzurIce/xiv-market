import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { TextField } from '@kobalte/core/text-field'
import {
  clearRequestTraces, createQueryResource, fetchJsonWithTimeout, getItemsDigest, getItemsSources, getItemsSize,
  loadedItemsSource, matchedData, requestTraces, selectedRegion, UNIVERSALIS_BASE_URL,
  type RequestTrace,
} from '@xiv-market/shared'
import { Badge } from '../badge'
import { Button, buttonVariants } from '../button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../card'
import { browserProfile } from '../debug/performance'
import { EmptyState } from '../empty-state'
import { PageHeader } from '../page-header'
import { Skeleton } from '../skeleton'
import { StatCard } from '../stat-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs'

interface Endpoint {
  id: string
  label: string
  url: string
  group: 'items' | 'directory' | 'market'
  sha256?: string
}

const ms = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(value < 10 ? 1 : 0)} ms`
const bytes = (value: number | null | undefined) => value == null ? '—' : value < 1000 ? `${value} B` : value < 1000 * 1000 ? `${(value / 1000).toFixed(1)} KB` : `${(value / 1000 / 1000).toFixed(2)} MB`
const duration = (trace: RequestTrace, now: number) => (trace.end ?? now) - trace.start
const statusLabel = (status: RequestTrace['status']) => ({ pending: '请求中', success: '成功', error: '失败', aborted: '已取消' })[status]
const phases = [
  { key: 'waitMs', label: '等待响应', color: 'bg-chart-3' },
  { key: 'readMs', label: '读取响应', color: 'bg-chart-2' },
  { key: 'verifyMs', label: '版本校验', color: 'bg-chart-4' },
  { key: 'parseMs', label: 'JSON 解析', color: 'bg-chart-1' },
] as const

function TraceBadge(props: { trace: RequestTrace }) {
  return <Badge variant={props.trace.status === 'error' ? 'destructive' : props.trace.status === 'success' ? 'secondary' : 'outline'}>{statusLabel(props.trace.status)}</Badge>
}

function Waterfall(props: { traces: readonly RequestTrace[]; now: number; select: (id: number) => void; selected?: number }) {
  const start = () => Math.min(...props.traces.map(trace => trace.start))
  const extent = () => Math.max(1, ...props.traces.map(trace => (trace.end ?? props.now) - start()))
  return (
    <div class="overflow-x-auto" role="region" aria-label="请求瀑布图" tabindex="0">
      <div class="min-w-[640px] space-y-1">
        <div class="grid grid-cols-[180px_1fr_90px] gap-3 px-2 text-xs text-muted-foreground mb-3">
          <span>请求 / 点击查看详情</span>
          <div class="flex justify-between"><span>0 ms</span><span>{ms(extent() / 2)}</span><span>{ms(extent())}</span></div>
          <span class="text-right">总耗时</span>
        </div>
        <For each={props.traces}>{trace => (
          <Button variant="ghost" class="grid! h-10 w-full grid-cols-[180px_minmax(0,1fr)_90px] gap-3 px-2 text-left font-normal" aria-pressed={props.selected === trace.id} onClick={() => props.select(trace.id)}>
            <span class="truncate text-xs" title={trace.label}>{trace.label}</span>
            <span class="relative h-5 w-full rounded bg-muted/60" aria-label={`${trace.label}，${statusLabel(trace.status)}，${ms(duration(trace, props.now))}`}>
              <span class="absolute top-0 flex h-full min-w-0.5 overflow-hidden rounded" style={{ left: `${(trace.start - start()) / extent() * 100}%`, width: `${duration(trace, props.now) / extent() * 100}%` }}>
                <Show when={trace.status !== 'pending'} fallback={<span class="w-full bg-muted-foreground/40 animate-pulse" />}>
                  <For each={phases}>{phase => <span class={phase.color} style={{ width: `${(trace[phase.key] ?? 0) / Math.max(1, duration(trace, props.now)) * 100}%` }} title={`${phase.label} ${ms(trace[phase.key])}`} />}</For>
                  <Show when={trace.status === 'error' || trace.status === 'aborted'}><span class={`flex-1 min-w-1 ${trace.status === 'error' ? 'bg-destructive/60' : 'bg-muted-foreground/40'}`} /></Show>
                </Show>
              </span>
            </span>
            <span class="text-right text-xs tabular-nums">{ms(duration(trace, props.now))}</span>
          </Button>
        )}</For>
      </div>
    </div>
  )
}

export default function Debug() {
  const [itemId, setItemId] = createSignal('2')
  const [cache, setCache] = createSignal<RequestCache>('default')
  const [now, setNow] = createSignal(performance.now())
  const [snapshot, setSnapshot] = createSignal(browserProfile())
  const [selected, setSelected] = createSignal<number>()
  const [busy, setBusy] = createSignal({ count: 0, total: 0, longest: 0 })
  const [profileFilter, setProfileFilter] = createSignal('all')
  const longTasksSupported = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')
  let controller: AbortController | undefined
  let nextRun = 0
  type ProbeRun = { id: number; endpoints: Endpoint[]; cache: RequestCache; signal: AbortSignal }
  const [run, setRun] = createSignal<ProbeRun | null>(null)
  const validItem = () => /^[1-9]\d*$/.test(itemId()) && Number.isSafeInteger(Number(itemId()))
  const endpoints = createMemo<Endpoint[]>(() => {
    const api = `${UNIVERSALIS_BASE_URL}/api/v2`
    const market = `${encodeURIComponent(selectedRegion())}/${itemId()}`
    return [
      ...getItemsSources().map(source => ({ ...source, label: `物品数据 · ${source.label}`, group: 'items' as const, sha256: getItemsDigest() })),
      { id: 'dcs', label: '数据中心列表', url: `${api}/data-centers`, group: 'directory' },
      { id: 'worlds', label: '服务器列表', url: `${api}/worlds`, group: 'directory' },
      { id: 'marketable', label: '可交易物品 ID', url: `${api}/marketable`, group: 'directory' },
      { id: 'aggregated', label: '聚合行情', url: `${api}/aggregated/${market}`, group: 'market' },
      { id: 'listings', label: '当前挂单', url: `${api}/${market}`, group: 'market' },
      { id: 'history', label: '成交历史', url: `${api}/history/${market}?entriesWithin=2592000`, group: 'market' },
    ]
  })
  const probe = createQueryResource(run, async (query, signal) => {
    const combined = AbortSignal.any([signal, query.signal])
    let completed = 0
    for (const endpoint of query.endpoints) {
      combined.throwIfAborted()
      try {
        await fetchJsonWithTimeout(endpoint.url, '测速请求失败', combined, { purpose: 'probe', cache: query.cache, label: endpoint.label, sha256: endpoint.sha256 })
      } catch (error) { if (combined.aborted) throw error }
      completed++
    }
    return { completed }
  })
  const completed = () => matchedData(probe.res(), query => query === run())?.completed
  const start = (targets: Endpoint[]) => {
    controller?.abort()
    controller = new AbortController()
    setRun({ id: ++nextRun, endpoints: targets, cache: cache(), signal: controller.signal })
  }
  const traces = createMemo(() => requestTraces().filter(trace => profileFilter() === 'all' || trace.purpose === profileFilter()))
  const selectedTrace = () => requestTraces().find(trace => trace.id === selected())
  const latest = (endpoint: Endpoint) => requestTraces().filter(trace => trace.purpose === 'probe' && trace.label === endpoint.label && trace.url === endpoint.url && trace.cache === cache()).at(-1)
  const samples = (endpoint: Endpoint) => requestTraces().filter(trace => trace.purpose === 'probe' && trace.label === endpoint.label && trace.url === endpoint.url && trace.cache === cache() && trace.status === 'success')
  const median = (endpoint: Endpoint) => {
    const values = samples(endpoint).map(trace => duration(trace, now())).sort((a, b) => a - b)
    return values.length ? (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2 : null
  }
  onMount(() => {
    const timer = window.setInterval(() => { setNow(performance.now()); setSnapshot(browserProfile()) }, 500)
    onCleanup(() => window.clearInterval(timer))
    if (longTasksSupported) {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) setBusy(value => ({ count: value.count + 1, total: value.total + entry.duration, longest: Math.max(value.longest, entry.duration) }))
      })
      observer.observe({ type: 'longtask', buffered: true })
      onCleanup(() => observer.disconnect())
    }
  })
  onCleanup(() => controller?.abort())

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader title="网络诊断" description="从当前浏览器测量数据源速度，查看本次访问的请求 Profile。" actions={<A href="/settings" class={buttonVariants({ variant: 'outline', size: 'sm' })}>返回设置</A>} />
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="当前物品数据源"><div class="text-xl font-semibold">{loadedItemsSource()?.label ?? '加载中 / 未就绪'}</div><p class="text-xs text-muted-foreground mt-1">TOS 优先，2 秒后启用备用源</p></StatCard>
        <StatCard title="首次内容绘制 FCP"><div class="text-xl font-semibold tabular-nums">{ms(snapshot().fcp)}</div><p class="text-xs text-muted-foreground mt-1">当前文档，不随路由切换重置</p></StatCard>
        <StatCard title="DOM 就绪"><div class="text-xl font-semibold tabular-nums">{ms(snapshot().domReady)}</div><p class="text-xs text-muted-foreground mt-1">文档加载完成 {ms(snapshot().load)}</p></StatCard>
        <StatCard title="主线程长任务"><div class="text-xl font-semibold">{longTasksSupported ? `${busy().count} 次` : '浏览器不支持'}</div><p class="text-xs text-muted-foreground mt-1">{longTasksSupported ? `累计 ${ms(busy().total)} · 最长 ${ms(busy().longest)}` : '可继续查看请求计时'}</p></StatCard>
      </div>
      <Tabs defaultValue="endpoints">
        <TabsList aria-label="诊断视图"><TabsTrigger value="endpoints">Endpoint 测速</TabsTrigger><TabsTrigger value="profile">请求 Profile</TabsTrigger><TabsTrigger value="browser">浏览器资源</TabsTrigger></TabsList>
        <TabsContent value="endpoints" class="space-y-4 pt-3">
          <Card>
            <CardHeader><CardTitle>测试选项</CardTitle><CardDescription>点击后才发起测速，逐项测量完整 HTTP 请求周期。区域与物品 ID 决定行情接口的请求范围。</CardDescription></CardHeader>
            <CardContent class="space-y-4">
              <div class="flex flex-wrap items-end gap-4">
                <TextField value={itemId()} onChange={setItemId} disabled={probe.loading()} validationState={validItem() ? 'valid' : 'invalid'} class="space-y-2"><TextField.Label class="block text-sm font-medium">物品 ID</TextField.Label><TextField.Input inputmode="numeric" class="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" /><TextField.ErrorMessage class="text-xs text-destructive">请输入正整数物品 ID</TextField.ErrorMessage></TextField>
                <div class="space-y-2"><p class="text-sm font-medium">浏览器 HTTP 缓存</p><Tabs value={cache()} onChange={value => setCache(value as RequestCache)}><TabsList aria-label="测速缓存方式"><TabsTrigger value="default" disabled={probe.loading()}>正常缓存</TabsTrigger><TabsTrigger value="no-store" disabled={probe.loading()}>绕过缓存</TabsTrigger></TabsList></Tabs></div>
                <Badge variant="outline">区域 · {selectedRegion()}</Badge>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button disabled={probe.loading()} onClick={() => start(endpoints().filter(endpoint => endpoint.group === 'directory'))}>测试基础接口</Button>
                <Button variant="outline" disabled={probe.loading() || !validItem()} onClick={() => start(endpoints().filter(endpoint => endpoint.group === 'market'))}>测试行情接口</Button>
                <Button variant="outline" disabled={probe.loading()} onClick={() => start(endpoints().filter(endpoint => endpoint.group === 'items'))}>比较两个物品数据源</Button>
                <Show when={probe.loading()}><Button variant="secondary" onClick={() => controller?.abort()}>停止测速</Button></Show>
              </div>
              <p class="text-xs text-muted-foreground">物品数据源比较会完整读取两份 JSON，合计约 {bytes(getItemsSize() * 2)} 解压后数据。正常缓存可能直接命中本地；绕过缓存会重新请求，但 CDN 缓存仍可能生效。基础接口测速直接请求网络，不使用应用的 localStorage 缓存。</p>
              <Show when={probe.loading()}><p role="status" class="text-sm text-muted-foreground">正在测速…</p></Show>
              <Show when={completed() != null && !probe.loading()}><p role="status" class="text-sm text-muted-foreground">本轮已完成 {completed()} 项；失败原因见各接口。</p></Show>
              <Show when={probe.error()}><EmptyState variant="error" title="测速失败" description={probe.error() ?? undefined} /></Show>
            </CardContent>
          </Card>
          <div class="grid gap-3 md:grid-cols-2">
            <For each={endpoints()}>{endpoint => (
              <Card>
                <CardHeader class="pb-3"><div class="flex items-center justify-between gap-2"><CardTitle class="text-base">{endpoint.label}</CardTitle><Button variant="outline" size="sm" aria-label={`测速 ${endpoint.label}`} disabled={probe.loading() || (endpoint.group === 'market' && !validItem())} onClick={() => start([endpoint])}>测速</Button></div><CardDescription class="break-all font-mono text-xs">{endpoint.url}</CardDescription></CardHeader>
                <CardContent>
                  <Show when={latest(endpoint)} fallback={<p class="text-sm text-muted-foreground">尚未测速</p>}>{trace => (
                    <div class="space-y-3">
                      <div class="flex items-center gap-2"><TraceBadge trace={trace()} /><span class="text-xs text-muted-foreground">{trace().httpStatus ? `HTTP ${trace().httpStatus}` : ''}</span><span class="ml-auto font-semibold tabular-nums">{ms(duration(trace(), now()))}</span></div>
                      <Show when={trace().status !== 'pending'} fallback={<Skeleton class="h-10 w-full" />}>
                        <dl class="grid grid-cols-3 gap-2 text-xs"><div><dt class="text-muted-foreground">等待响应</dt><dd class="mt-1 tabular-nums">{ms(trace().waitMs)}</dd></div><div><dt class="text-muted-foreground">读取响应</dt><dd class="mt-1 tabular-nums">{ms(trace().readMs)}</dd></div><div><dt class="text-muted-foreground">响应体大小</dt><dd class="mt-1 tabular-nums">{bytes(trace().bytes)}</dd></div></dl>
                      </Show>
                      <Show when={trace().error}><p class="text-xs text-destructive break-words">{trace().error}</p></Show>
                      <p class="text-xs text-muted-foreground">成功样本 {samples(endpoint).length} · 中位数 {ms(median(endpoint))} · 仅统计当前缓存方式</p>
                    </div>
                  )}</Show>
                </CardContent>
              </Card>
            )}</For>
          </div>
        </TabsContent>
        <TabsContent value="profile" class="space-y-4 pt-3">
          <Card>
            <CardHeader><div class="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>数据请求瀑布图</CardTitle><CardDescription class="mt-1">记录本次访问中最近 200 个应用与测速请求，仅保存在当前页面内存中。</CardDescription></div><Button variant="outline" size="sm" onClick={() => { clearRequestTraces(); setSelected(undefined) }}>清空记录</Button></div></CardHeader>
            <CardContent class="space-y-4">
              <Tabs value={profileFilter()} onChange={setProfileFilter}><TabsList aria-label="请求来源筛选"><TabsTrigger value="all">全部</TabsTrigger><TabsTrigger value="app">应用请求</TabsTrigger><TabsTrigger value="probe">手动测速</TabsTrigger></TabsList></Tabs>
              <div class="flex flex-wrap gap-4 text-xs text-muted-foreground"><For each={phases}>{phase => <span class="flex items-center gap-1.5"><span class={`size-2 rounded-sm ${phase.color}`} />{phase.label}</span>}</For></div>
              <Show when={traces().length} fallback={<EmptyState title="暂无请求记录" description="浏览市场、打开物品详情或手动测速后，会在这里显示请求。" />}><Waterfall traces={traces()} now={now()} selected={selected()} select={setSelected} /></Show>
              <Show when={selectedTrace()}>{trace => (
                <div class="rounded-md border p-4 space-y-3">
                  <div class="flex items-center gap-2"><span class="font-medium text-sm">{trace().label}</span><TraceBadge trace={trace()} /></div>
                  <p class="text-xs font-mono break-all text-muted-foreground">{trace().url}</p>
                  <dl class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm"><For each={phases}>{phase => <div><dt class="text-muted-foreground text-xs">{phase.label}</dt><dd class="mt-1 tabular-nums">{ms(trace()[phase.key])}</dd></div>}</For><div><dt class="text-muted-foreground text-xs">响应体大小 / 解压后</dt><dd class="mt-1">{bytes(trace().bytes)}</dd></div><div><dt class="text-muted-foreground text-xs">HTTP 状态</dt><dd class="mt-1">{trace().httpStatus ?? '无响应'}</dd></div><div><dt class="text-muted-foreground text-xs">缓存方式</dt><dd class="mt-1">{trace().cache}</dd></div><div><dt class="text-muted-foreground text-xs">总耗时</dt><dd class="mt-1">{ms(duration(trace(), now()))}</dd></div></dl>
                  <Show when={trace().error}><p class="text-sm text-destructive break-all">{trace().error}</p></Show>
                </div>
              )}</Show>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="browser" class="pt-3">
          <Card><CardHeader><CardTitle>浏览器 Resource Timing</CardTitle><CardDescription>最近 100 个资源，包含脚本、样式与图片。跨域服务未开放 Timing-Allow-Origin 时，连接明细显示未知；0 ms 也可能表示缓存或连接复用。</CardDescription></CardHeader><CardContent>
            <div class="overflow-x-auto" role="region" aria-label="浏览器资源计时" tabindex="0"><table class="w-full min-w-[760px] text-xs"><thead><tr class="border-b text-left text-muted-foreground"><th class="py-3 font-medium">资源</th><th class="font-medium">总耗时</th><th class="font-medium">DNS</th><th class="font-medium">连接 / 含 TLS</th><th class="font-medium">TLS</th><th class="font-medium">TTFB</th><th class="font-medium">传输大小</th><th class="font-medium">缓存</th></tr></thead><tbody><For each={snapshot().resources}>{resource => <tr class="border-b last:border-0"><td class="max-w-64 truncate py-3 pr-4" title={resource.name}>{new URL(resource.name, location.href).pathname}</td><td>{ms(resource.duration)}</td><td>{ms(resource.dns)}</td><td>{ms(resource.connect)}</td><td>{ms(resource.tls)}</td><td>{ms(resource.ttfb)}</td><td>{bytes(resource.transfer)}</td><td>{resource.cached == null ? '未知' : resource.cached ? '本地命中' : '网络'}</td></tr>}</For></tbody></table></div>
            <Show when={!snapshot().resources.length}><EmptyState title="暂无资源计时" description="当前浏览器尚未提供资源记录。" /></Show>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
