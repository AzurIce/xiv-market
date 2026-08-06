import { createEffect, createSignal, createMemo, onCleanup, For, Show } from 'solid-js'
import { useNavigate, useSearchParams } from '@solidjs/router'
import {
  fetchMarketableItems, fetchAggregatedData,
  createQueryResource, matchedData,
  selectedRegion,
  getItemName, canItemBeHq,
  type AggregatedItemData,
} from '@xiv-market/shared'
import { Card, CardContent } from '../card'
import { QualityBadge } from '../quality-badge'
import { Input } from '../input'
import { Skeleton } from '../skeleton'
import { Table, TableBody, TableRow, TableHead, TableCell, TableHeader } from '../table'
import { Pagination } from '../pagination'
import { PageHeader } from '../page-header'
import { EmptyState } from '../empty-state'
import { RefreshButton } from '../refresh-button'
import { WorldBadge } from '../world-badge'
import { ItemIcon } from '../item-icon'
import { useErrorToast } from '../use-error-toast'

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

// NQ/HQ 标签统一走共享 QualityBadge（HQ=琥珀黄、NQ=secondary 灰）
function HqTag() {
  return <QualityBadge hq class="px-1 py-px leading-none" />
}

function NqTag() {
  return <QualityBadge hq={false} class="px-1 py-px leading-none" />
}

function PriceNqHq(props: { nq?: number; hq?: number; canBeHq?: boolean }) {
  const hasNq = createMemo(() => props.nq != null && props.nq! > 0)
  const hasHq = createMemo(() => props.hq != null && props.hq! > 0)
  const onlyNq = createMemo(() => hasNq() && !hasHq())
  // 不可 HQ 的物品没有品质区分，NQ badge 省略（HQ badge 始终保留）
  const showNqTag = () => props.canBeHq !== false
  return (
    <div class="flex flex-col gap-0.5 leading-tight">
      <Show when={hasNq()}>
        <span class="flex items-center gap-1">
          <Show when={showNqTag()}><NqTag /></Show><span class={onlyNq() ? 'font-medium' : 'text-muted-foreground'}>{formatGil(props.nq!)}</span>
        </span>
      </Show>
      <Show when={hasHq()}>
        <span class="flex items-center gap-1">
          <HqTag /><span class="font-medium">{formatGil(props.hq!)}</span>
        </span>
      </Show>
      <Show when={!hasNq() && !hasHq()}>
        <span class="text-muted-foreground">-</span>
      </Show>
    </div>
  )
}

function VelocityNqHq(props: { nq?: number; hq?: number; canBeHq?: boolean }) {
  const hasNq = createMemo(() => props.nq != null && props.nq! > 0)
  const hasHq = createMemo(() => props.hq != null && props.hq! > 0)
  const onlyNq = createMemo(() => hasNq() && !hasHq())
  const fmt = (v: number) => v < 0.01 ? '<0.01' : v.toFixed(2)
  const showNqTag = () => props.canBeHq !== false
  return (
    <div class="flex flex-col gap-0.5 leading-tight">
      <Show when={hasNq()}>
        <span class="flex items-center gap-1">
          <Show when={showNqTag()}><NqTag /></Show><span class={onlyNq() ? 'font-medium' : 'text-muted-foreground'}>{fmt(props.nq!)}/天</span>
        </span>
      </Show>
      <Show when={hasHq()}>
        <span class="flex items-center gap-1">
          <HqTag /><span class="font-medium">{fmt(props.hq!)}/天</span>
        </span>
      </Show>
      <Show when={!hasNq() && !hasHq()}>
        <span class="text-muted-foreground">-</span>
      </Show>
    </div>
  )
}

// 骨架行数跟随当前页行数：翻页/搜索导致的重新加载不产生高度跳动
function TableSkeleton(props: { rows: number }) {
  return (
    <div class="px-6 space-y-4" role="status">
      <span class="sr-only">加载中</span>
      <For each={Array.from({ length: props.rows })}>
        {() => <Skeleton class="h-10 w-full" />}
      </For>
    </div>
  )
}

function MobileItemCard(props: {
  itemId: number
  agg?: AggregatedItemData
  onClick: (e: MouseEvent) => void
}) {
  const minNqPrice = () => props.agg?.nq.minListingPrice
  const minHqPrice = () => props.agg?.hq.minListingPrice
  const avgNqPrice = () => props.agg?.nq.averageSalePrice
  const avgHqPrice = () => props.agg?.hq.averageSalePrice
  const minNqWorldId = () => props.agg?.nq.minListingWorldId
  const minHqWorldId = () => props.agg?.hq.minListingWorldId
  const nqVelocity = () => props.agg?.nq.dailySaleVelocity ?? 0
  const hqVelocity = () => props.agg?.hq.dailySaleVelocity ?? 0
  // 不可 HQ 的物品没有品质区分，NQ badge 省略
  const hqAble = () => canItemBeHq(props.itemId)

  return (
    <Card class="cursor-pointer hover:shadow-md transition-shadow py-2" onClick={props.onClick} onAuxClick={props.onClick} role="button" tabindex="0" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onClick(e as unknown as MouseEvent) } }}>
      <CardContent class="px-2 py-0 space-y-1">
        {/* 第一行：图标 + 名称 + ID */}
        <div class="flex items-center gap-2.5">
          <ItemIcon itemId={props.itemId} class="h-7 w-7 rounded shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm truncate leading-tight">{getItemName(props.itemId)}</div>
            <div class="text-[10px] text-muted-foreground">#{props.itemId}</div>
          </div>
        </div>

        {/* 第二行：最低挂单（左）+ 均价（右） */}
        <div class="flex items-start justify-between text-xs">
          <div class="min-w-0">
            <Show when={minNqPrice() != null && minNqPrice()! > 0}>
              <div class="flex items-center gap-1">
                <Show when={hqAble()}><NqTag /></Show><span class="font-medium">{formatGil(minNqPrice()!)}</span>
              </div>
              <Show when={minNqWorldId()}>
                <div class="mt-0.5"><WorldBadge worldId={minNqWorldId()} class="text-[10px] text-muted-foreground" /></div>
              </Show>
            </Show>
              <Show when={minHqPrice() != null && minHqPrice()! > 0}>
              <div class="flex items-center gap-1">
                <HqTag /><span class="font-medium">{formatGil(minHqPrice()!)}</span>
              </div>
              <Show when={minHqWorldId()}>
                <div class="mt-0.5"><WorldBadge worldId={minHqWorldId()} class="text-[10px] text-muted-foreground" /></div>
              </Show>
            </Show>
          </div>
          <div class="text-right min-w-0 pl-2">
            <div class="text-[10px] text-muted-foreground">均价</div>
            <div class="whitespace-nowrap">
              <PriceNqHq nq={avgNqPrice()} hq={avgHqPrice()} canBeHq={hqAble()} />
            </div>
          </div>
        </div>

        {/* 第三行：日销量 + 时间 */}
        <div class="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          <div class="flex items-center gap-1.5">
            <Show when={nqVelocity() > 0}>
              <span class="flex items-center gap-1"><Show when={hqAble()}><NqTag /></Show>{nqVelocity().toFixed(2)}/天</span>
            </Show>
            <Show when={hqVelocity() > 0}>
              <span class="flex items-center gap-1"><HqTag />{hqVelocity().toFixed(2)}/天</span>
            </Show>
            <Show when={nqVelocity() === 0 && hqVelocity() === 0}>
              <span>-</span>
            </Show>
          </div>
          <span>{formatTime(props.agg?.lastUploadTime ?? 0)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearchQuery = typeof searchParams.q === 'string' ? searchParams.q : ''
  const [searchQuery, setSearchQuery] = createSignal(initialSearchQuery)
  const [debouncedQuery, setDebouncedQuery] = createSignal(initialSearchQuery)
  const [isComposing, setIsComposing] = createSignal(false)
  const [page, setPage] = createSignal(1)
  const PAGE_SIZE = 50

  createEffect(() => {
    if (isComposing()) return
    const q = typeof searchParams.q === 'string' ? searchParams.q : ''
    if (q !== searchQuery()) {
      setSearchQuery(q)
      setDebouncedQuery(q)
      setPage(1)
    }
  })

  const marketable = createQueryResource(() => true, (_, signal) => fetchMarketableItems(signal))
  const marketableItems = () => marketable.res()?.data

  const pagedItems = createMemo(() => {
    const all = marketableItems() ?? []
    const q = debouncedQuery().trim().toLowerCase()
    const filtered = q
      ? all.filter(id => {
          const name = getItemName(id).toLowerCase()
          return id.toString().includes(q) || name.includes(q)
        })
      : all
    return filtered
  })

  const totalPages = createMemo(() => Math.max(1, Math.ceil(pagedItems().length / PAGE_SIZE)))
  const currentItems = createMemo(() => {
    const start = (page() - 1) * PAGE_SIZE
    return pagedItems().slice(start, start + PAGE_SIZE)
  })

  // 数据与查询参数配对：渲染只接受与当前 region + 当前页 items 匹配的数据。
  // 不匹配（翻页/搜索/切区后的旧数据）视为无数据 → 骨架，而不是整页 "-" 误读为无行情；
  // 点刷新（同参数 refetch）时旧数据仍匹配 → 保留内容，由刷新按钮的旋转表达加载中
  const agg = createQueryResource(
    () => {
      if (!marketableItems()) return null
      return { region: selectedRegion(), items: currentItems() }
    },
    async ({ region, items }, signal) => {
      const map = new Map<number, AggregatedItemData>()
      if (items.length) {
        const results = await fetchAggregatedData(region, items.join(','), 'region', signal)
        for (const item of results) {
          map.set(item.itemId, item)
        }
      }
      return map
    }
  )
  const aggMap = () =>
    matchedData(agg.res(), (q) => q.region === selectedRegion() && q.items === currentItems())

  // 错误落点：无数据 → 下方错误屏；有数据（点刷新失败）→ toast
  useErrorToast(agg.error, () => aggMap() !== undefined, agg.refetch)

  const getItemAgg = (itemId: number) => aggMap()?.get(itemId)

  const tableError = () => marketable.error() ?? agg.error()

  const handleRefresh = () => {
    // 前置（可交易物品列表）未就绪时重试前置；否则只刷新聚合数据（参数不变，内容保留）
    if (marketableItems() === undefined) marketable.refetch()
    else agg.refetch()
  }

  let searchTimer: number | undefined
  onCleanup(() => window.clearTimeout(searchTimer))

  const setSearch = (value: string) => {
    setSearchQuery(value)
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      setDebouncedQuery(value)
      setPage(1)
      setSearchParams(value ? { q: value } : { q: undefined }, { replace: true })
    }, 300)
  }

  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    if (isComposing()) return
    setSearch(e.currentTarget.value)
  }

  const handleCompositionEnd = (e: CompositionEvent & { currentTarget: HTMLInputElement }) => {
    setIsComposing(false)
    setSearch(e.currentTarget.value)
  }

  const itemPath = (itemId: number) => {
    const q = searchQuery().trim()
    return q ? `/item/${itemId}?q=${encodeURIComponent(q)}` : `/item/${itemId}`
  }

  const itemUrl = (itemId: number) => {
    const url = new URL(window.location.href)
    url.hash = itemPath(itemId)
    return url.toString()
  }

  const openItem = (itemId: number, e?: MouseEvent) => {
    if (e?.button === 1 || e?.ctrlKey || e?.metaKey) {
      e.preventDefault()
      window.open(itemUrl(itemId), '_blank', 'noopener')
      return
    }
    navigate(itemPath(itemId))
  }

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="市场总览"
        description="浏览 FFXIV 可交易物品的市场行情"
        actions={<RefreshButton loading={agg.loading() || marketable.loading()} onClick={handleRefresh} />}
      />

      <div class="flex flex-col gap-4 mb-6">
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              type="text"
              placeholder="搜索物品名称或 ID..."
              value={searchQuery()}
              onInput={handleInput}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={handleCompositionEnd}
              class="pl-10 pr-16"
            />
            <Show when={searchQuery()}>
              <button
                type="button"
                class="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setSearch('')}
                aria-label="清除搜索"
                title="清除搜索"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </Show>
          </div>
          <Show when={marketableItems()}>
            <div class="text-sm text-muted-foreground flex items-center shrink-0">
              共 <span class="font-medium text-foreground mx-1">{pagedItems().length.toLocaleString()}</span> 个物品
            </div>
          </Show>
        </div>
      </div>

      <div class="pb-2">
        <Show
          when={aggMap() !== undefined}
          fallback={
            <Show
              when={!tableError()}
              fallback={
                <EmptyState
                  variant="error"
                  title={marketable.error() ? '物品列表加载失败' : '市场数据加载失败'}
                  description={tableError() ?? undefined}
                  action={
                    <RefreshButton loading={marketable.loading() || agg.loading()} onClick={handleRefresh} />
                  }
                />
              }
            >
              <TableSkeleton rows={currentItems().length || 10} />
            </Show>
          }
        >
          <Show
            when={currentItems().length > 0}
            fallback={
              <EmptyState
                title="未找到物品"
                description={debouncedQuery() ? `未找到与 "${debouncedQuery()}" 匹配的物品` : "该区域暂无市场数据"}
                action={
                  <Show when={searchQuery()}>
                    <button class="text-sm text-primary hover:underline" onClick={() => setSearch('')}>清除搜索</button>
                  </Show>
                }
              />
            }
          >
            {/* Desktop/Tablet table */}
            <div class="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead>物品</TableHead>
                    <TableHead>最低挂单</TableHead>
                    <TableHead>均价</TableHead>
                    <TableHead>日销量</TableHead>
                    <TableHead class="hidden lg:table-cell w-[120px]">数据更新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={currentItems()}>
                    {(itemId) => {
                      const agg = createMemo(() => getItemAgg(itemId))
                      const minListingInfo = createMemo(() => {
                        const d = agg()
                        if (!d) return null
                        const nqPrice = d.nq.minListingPrice
                        const hqPrice = d.hq.minListingPrice
                        const nqWorldId = d.nq.minListingWorldId
                        const hqWorldId = d.hq.minListingWorldId
                        return { nqPrice, hqPrice, nqWorldId, hqWorldId }
                      })
                      // 不可 HQ 的物品没有品质区分，NQ badge 省略
                      const hqAble = () => canItemBeHq(itemId)

                      return (
                        <TableRow
                          class="cursor-pointer"
                          onClick={(e) => openItem(itemId, e)}
                          onAuxClick={(e) => openItem(itemId, e)}
                        >
                          <TableCell>
                            <div class="flex items-center gap-2">
                              <ItemIcon itemId={itemId} class="h-6 w-6 rounded" />
                              <div class="flex flex-col min-w-0">
                                <span class="font-medium text-sm truncate max-w-xs">{getItemName(itemId)}</span>
                                <span class="text-xs text-muted-foreground">#{itemId}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Show when={minListingInfo()} fallback={<span class="text-muted-foreground">-</span>}>
                              <div class="flex flex-col gap-0.5 leading-tight">
                                <Show when={minListingInfo()!.nqPrice != null && minListingInfo()!.nqPrice! > 0}>
                                  <span class="flex items-center gap-1">
                                    <Show when={hqAble()}><NqTag /></Show>
                                    <span class="font-medium">{formatGil(minListingInfo()!.nqPrice!)} Gil</span>
                                    <Show when={minListingInfo()!.nqWorldId}><WorldBadge worldId={minListingInfo()!.nqWorldId} class="text-xs text-muted-foreground" /></Show>
                                  </span>
                                </Show>
                                <Show when={minListingInfo()!.hqPrice != null && minListingInfo()!.hqPrice! > 0}>
                                  <span class="flex items-center gap-1">
                                    <HqTag />
                                    <span class="font-medium">{formatGil(minListingInfo()!.hqPrice!)} Gil</span>
                                    <Show when={minListingInfo()!.hqWorldId}><WorldBadge worldId={minListingInfo()!.hqWorldId} class="text-xs text-muted-foreground" /></Show>
                                  </span>
                                </Show>
                                <Show when={!(minListingInfo()!.nqPrice) && !(minListingInfo()!.hqPrice)}>
                                  <span class="text-muted-foreground">-</span>
                                </Show>
                              </div>
                            </Show>
                          </TableCell>
                          <TableCell>
                            <PriceNqHq
                              nq={agg()?.nq.averageSalePrice}
                              hq={agg()?.hq.averageSalePrice}
                              canBeHq={hqAble()}
                            />
                          </TableCell>
                          <TableCell>
                            <VelocityNqHq
                              nq={agg()?.nq.dailySaleVelocity}
                              hq={agg()?.hq.dailySaleVelocity}
                              canBeHq={hqAble()}
                            />
                          </TableCell>
                          <TableCell class="hidden lg:table-cell">
                            <span class="text-xs text-muted-foreground">
                              {formatTime(agg()?.lastUploadTime ?? 0)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    }}
                  </For>
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div class="sm:hidden space-y-2">
              <For each={currentItems()}>
                {(itemId) => (
                  <MobileItemCard
                    itemId={itemId}
                    agg={getItemAgg(itemId)}
                    onClick={(e) => openItem(itemId, e)}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      <Show when={totalPages() > 1}>
        <div class="mt-4 flex flex-col items-center gap-2">
          <span class="text-xs text-muted-foreground">
            第 {page()} / {totalPages()} 页
          </span>
          <Pagination page={page()} totalPages={totalPages()} onChange={setPage} />
        </div>
      </Show>
    </div>
  )
}
