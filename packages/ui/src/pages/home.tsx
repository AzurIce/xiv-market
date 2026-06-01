import { createEffect, createResource, createSignal, createMemo, For, Show, Suspense } from 'solid-js'
import { useNavigate, useSearchParams } from '@solidjs/router'
import {
  fetchMarketableItems, fetchAggregatedData,
  selectedRegion, getWorldDisplayName,
  getItemName, getItemIconUrl,
  type AggregatedItemData,
} from '@xiv-market/shared'
import { Card, CardContent } from '../card'
import { Input } from '../input'
import { Skeleton } from '../skeleton'
import { Table, TableBody, TableRow, TableHead, TableCell, TableHeader } from '../table'
import { Pagination } from '../pagination'
import { PageHeader } from '../page-header'
import { EmptyState } from '../empty-state'

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

function HqTag() {
  return <span class="inline-flex items-center rounded px-1 py-px text-xs font-semibold leading-none bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">HQ</span>
}

function NqTag() {
  return <span class="inline-flex items-center rounded px-1 py-px text-xs font-medium leading-none bg-muted text-muted-foreground border border-border">NQ</span>
}

function PriceNqHq(props: { nq?: number; hq?: number }) {
  const hasNq = createMemo(() => props.nq != null && props.nq! > 0)
  const hasHq = createMemo(() => props.hq != null && props.hq! > 0)
  const both = createMemo(() => hasNq() && hasHq())
  const onlyNq = createMemo(() => hasNq() && !hasHq())
  return (
    <div class="flex flex-col gap-0.5 leading-tight">
      <Show when={both() || onlyNq()}>
        <span class="flex items-center gap-1">
          {both() && <NqTag />}<span class={onlyNq() ? 'font-medium' : 'text-muted-foreground'}>{formatGil(props.nq!)}</span>
        </span>
      </Show>
      <Show when={hasHq()}>
        <span class="flex items-center gap-1">
          {both() && <HqTag />}<span class="font-medium">{formatGil(props.hq!)}</span>
        </span>
      </Show>
      <Show when={!hasNq() && !hasHq()}>
        <span class="text-muted-foreground">-</span>
      </Show>
    </div>
  )
}

function VelocityNqHq(props: { nq?: number; hq?: number }) {
  const hasNq = createMemo(() => props.nq != null && props.nq! > 0)
  const hasHq = createMemo(() => props.hq != null && props.hq! > 0)
  const both = createMemo(() => hasNq() && hasHq())
  const onlyNq = createMemo(() => hasNq() && !hasHq())
  const fmt = (v: number) => v < 0.01 ? '<0.01' : v.toFixed(2)
  return (
    <div class="flex flex-col gap-0.5 leading-tight">
      <Show when={both() || onlyNq()}>
        <span class="flex items-center gap-1">
          {both() && <NqTag />}<span class={onlyNq() ? 'font-medium' : 'text-muted-foreground'}>{fmt(props.nq!)}/天</span>
        </span>
      </Show>
      <Show when={hasHq()}>
        <span class="flex items-center gap-1">
          {both() && <HqTag />}<span class="font-medium">{fmt(props.hq!)}/天</span>
        </span>
      </Show>
      <Show when={!hasNq() && !hasHq()}>
        <span class="text-muted-foreground">-</span>
      </Show>
    </div>
  )
}

function MobileItemCard(props: {
  itemId: number
  agg?: AggregatedItemData
  onClick: (e: MouseEvent) => void
}) {
  const iconUrls = () => getItemIconUrl(props.itemId)
  const handleIconError = (e: Event, urls: string[], idx: number) => {
    const img = e.currentTarget as HTMLImageElement
    if (idx < urls.length - 1) {
      img.src = urls[idx + 1]
    } else {
      img.style.display = 'none'
    }
  }
  const minNqPrice = () => props.agg?.nq.minListingPrice
  const minHqPrice = () => props.agg?.hq.minListingPrice
  const avgNqPrice = () => props.agg?.nq.averageSalePrice
  const avgHqPrice = () => props.agg?.hq.averageSalePrice
  const minNqWorld = () => props.agg?.nq.minListingWorldId ? getWorldDisplayName(props.agg.nq.minListingWorldId) : null
  const minHqWorld = () => props.agg?.hq.minListingWorldId ? getWorldDisplayName(props.agg.hq.minListingWorldId) : null
  const nqVelocity = () => props.agg?.nq.dailySaleVelocity ?? 0
  const hqVelocity = () => props.agg?.hq.dailySaleVelocity ?? 0

  return (
    <Card class="cursor-pointer hover:shadow-md transition-shadow py-2" onClick={props.onClick} onAuxClick={props.onClick} role="button" tabindex="0" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onClick(e as unknown as MouseEvent) } }}>
      <CardContent class="px-2 py-0 space-y-1">
        {/* 第一行：图标 + 名称 + ID */}
        <div class="flex items-center gap-2.5">
          <Show when={iconUrls().length > 0}>
            <img src={iconUrls()[0]} alt="" class="h-7 w-7 rounded shrink-0" loading="lazy" onError={(e) => handleIconError(e, iconUrls(), 0)} />
          </Show>
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
                <NqTag /><span class="font-medium">{formatGil(minNqPrice()!)}</span>
              </div>
              <Show when={minNqWorld()}>
                <div class="text-[10px] text-muted-foreground truncate mt-0.5">{minNqWorld()}</div>
              </Show>
            </Show>
              <Show when={minHqPrice() != null && minHqPrice()! > 0}>
              <div class="flex items-center gap-1">
                <HqTag /><span class="font-medium">{formatGil(minHqPrice()!)}</span>
              </div>
              <Show when={minHqWorld()}>
                <div class="text-[10px] text-muted-foreground truncate mt-0.5">{minHqWorld()}</div>
              </Show>
            </Show>
          </div>
          <div class="text-right min-w-0 pl-2">
            <div class="text-[10px] text-muted-foreground">均价</div>
            <div class="whitespace-nowrap">
              <PriceNqHq nq={avgNqPrice()} hq={avgHqPrice()} />
            </div>
          </div>
        </div>

        {/* 第三行：日销量 + 时间 */}
        <div class="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          <div class="flex items-center gap-1.5">
            <Show when={nqVelocity() > 0}>
              <span>NQ {nqVelocity().toFixed(2)}/天</span>
            </Show>
            <Show when={hqVelocity() > 0}>
              <span>HQ {hqVelocity().toFixed(2)}/天</span>
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
  const [page, setPage] = createSignal(1)
  const PAGE_SIZE = 50

  createEffect(() => {
    const q = typeof searchParams.q === 'string' ? searchParams.q : ''
    if (q !== searchQuery()) {
      setSearchQuery(q)
      setPage(1)
    }
  })

  const [marketableItems] = createResource(fetchMarketableItems)

  const pagedItems = createMemo(() => {
    const all = marketableItems() ?? []
    const q = searchQuery().trim().toLowerCase()
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

  const [aggData] = createResource(
    () => ({ region: selectedRegion(), items: currentItems() }),
    async ({ region, items }) => {
      if (!items.length) return new Map<number, AggregatedItemData>()
      try {
        const results = await fetchAggregatedData(region, items.join(','))
        const map = new Map<number, AggregatedItemData>()
        for (const item of results) {
          map.set(item.itemId, item)
        }
        return map
      } catch {
        return new Map<number, AggregatedItemData>()
      }
    }
  )

  const getItemAgg = (itemId: number) => aggData()?.get(itemId)

  const setSearch = (value: string) => {
    setSearchQuery(value)
    setPage(1)
    setSearchParams(value ? { q: value } : { q: undefined }, { replace: true })
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
              onInput={(e) => setSearch(e.currentTarget.value)}
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
          <Suspense fallback={
            <div class="px-6 space-y-4">
              <For each={Array.from({ length: 10 })}>
                {() => <Skeleton class="h-10 w-full" />}
              </For>
            </div>
          }>
            <Show
              when={currentItems().length > 0}
              fallback={
                <Show when={marketableItems()}>
                  <EmptyState
                    title="未找到物品"
                    description={searchQuery() ? `未找到与 "${searchQuery()}" 匹配的物品` : "该区域暂无市场数据"}
                    action={
                      <Show when={searchQuery()}>
                        <button class="text-sm text-primary hover:underline" onClick={() => setSearch('')}>清除搜索</button>
                      </Show>
                    }
                  />
                </Show>
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
                          const nqWorld = d.nq.minListingWorldId ? getWorldDisplayName(d.nq.minListingWorldId) : null
                          const hqWorld = d.hq.minListingWorldId ? getWorldDisplayName(d.hq.minListingWorldId) : null
                          return { nqPrice, hqPrice, nqWorld, hqWorld }
                        })

                        return (
                          <TableRow
                            class="cursor-pointer"
                            onClick={(e) => openItem(itemId, e)}
                            onAuxClick={(e) => openItem(itemId, e)}
                          >
                            <TableCell>
                              <div class="flex items-center gap-2">
                                <Show when={getItemIconUrl(itemId).length > 0}>
                                  <img
                                    src={getItemIconUrl(itemId)[0]}
                                    alt=""
                                    class="h-6 w-6 rounded"
                                    loading="lazy"
                                    onError={(e) => {
                                      const urls = getItemIconUrl(itemId)
                                      if (urls.length > 1) {
                                        e.currentTarget.src = urls[1]
                                      } else {
                                        e.currentTarget.style.display = 'none'
                                      }
                                    }}
                                  />
                                </Show>
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
                                      {(minListingInfo()!.hqPrice != null && minListingInfo()!.hqPrice! > 0) && <NqTag />}
                                      <span class="font-medium">{formatGil(minListingInfo()!.nqPrice!)} Gil</span>
                                      <Show when={minListingInfo()!.nqWorld}><span class="text-xs text-muted-foreground">{minListingInfo()!.nqWorld}</span></Show>
                                    </span>
                                  </Show>
                                  <Show when={minListingInfo()!.hqPrice != null && minListingInfo()!.hqPrice! > 0}>
                                    <span class="flex items-center gap-1">
                                      {(minListingInfo()!.nqPrice != null && minListingInfo()!.nqPrice! > 0) && <HqTag />}
                                      <span class="font-medium">{formatGil(minListingInfo()!.hqPrice!)} Gil</span>
                                      <Show when={minListingInfo()!.hqWorld}><span class="text-xs text-muted-foreground">{minListingInfo()!.hqWorld}</span></Show>
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
                              />
                            </TableCell>
                            <TableCell>
                              <VelocityNqHq
                                nq={agg()?.nq.dailySaleVelocity}
                                hq={agg()?.hq.dailySaleVelocity}
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
          </Suspense>
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
