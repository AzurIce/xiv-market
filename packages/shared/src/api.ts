import type { DataCenter, World, MarketData, HistoryData, AggregatedItemData } from './types'

const BASE_URL = import.meta.env?.DEV ? '/api/universalis' : 'https://universalis.app'

const STATIC_CACHE_TTL = 24 * 60 * 60 * 1000
const DC_CACHE_KEY = 'xiv_data_centers'
const WORLDS_CACHE_KEY = 'xiv_worlds'

async function fetchWithLocalCache<T>(cacheKey: string, path: string, errorMessage: string): Promise<T> {
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < STATIC_CACHE_TTL) return data as T
    } catch { /* ignore */ }
  }
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(errorMessage)
  const data = (await res.json()) as T
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* quota exceeded */ }
  return data
}

export function fetchDataCenters(): Promise<DataCenter[]> {
  return fetchWithLocalCache(DC_CACHE_KEY, '/api/v2/data-centers', 'Failed to fetch data centers')
}

export function fetchWorlds(): Promise<World[]> {
  return fetchWithLocalCache(WORLDS_CACHE_KEY, '/api/v2/worlds', 'Failed to fetch worlds')
}

// 按 key 的在途请求取消：同 key 的新请求会 abort 旧请求，
// 避免快速翻页/切换范围时在途旧请求浪费带宽。不同 key（如 Materia 的并发批次）互不影响。
const inflightRequests = new Map<string, AbortController>()

async function fetchWithAbort(key: string, url: string): Promise<Response> {
  inflightRequests.get(key)?.abort()
  const controller = new AbortController()
  inflightRequests.set(key, controller)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    if (inflightRequests.get(key) === controller) inflightRequests.delete(key)
  }
}

const MARKETABLE_CACHE_KEY = 'xiv_marketable_items'
const MARKETABLE_CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchMarketableItems(): Promise<number[]> {
  const cached = localStorage.getItem(MARKETABLE_CACHE_KEY)
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < MARKETABLE_CACHE_TTL) return data
    } catch { /* ignore */ }
  }
  const res = await fetch(`${BASE_URL}/api/v2/marketable`)
  if (!res.ok) throw new Error('Failed to fetch marketable items')
  const data = await res.json()
  try {
    localStorage.setItem(MARKETABLE_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* quota exceeded */ }
  return data
}

export async function fetchAggregatedData(
  worldDcRegion: string,
  itemIds: string,
  scope: 'region' | 'dc' | 'world' = 'region'
): Promise<AggregatedItemData[]> {
  const res = await fetchWithAbort(
    `aggregated:${worldDcRegion}:${itemIds}`,
    `${BASE_URL}/api/v2/aggregated/${encodeURIComponent(worldDcRegion)}/${itemIds}`
  )
  if (!res.ok) throw new Error('Failed to fetch aggregated data')
  const json = await res.json()
  const scopeKey = scope === 'region' ? 'region' : scope === 'dc' ? 'dc' : 'world'
  const results: AggregatedItemData[] = (json.results ?? []).map((item: any) => ({
    itemId: item.itemId,
    nq: {
      minListingPrice: item.nq?.minListing?.[scopeKey]?.price,
      minListingWorldId: item.nq?.minListing?.[scopeKey]?.worldId,
      recentPurchasePrice: item.nq?.recentPurchase?.[scopeKey]?.price,
      recentPurchaseTimestamp: item.nq?.recentPurchase?.[scopeKey]?.timestamp,
      recentPurchaseWorldId: item.nq?.recentPurchase?.[scopeKey]?.worldId,
      averageSalePrice: item.nq?.averageSalePrice?.[scopeKey]?.price,
      dailySaleVelocity: item.nq?.dailySaleVelocity?.[scopeKey]?.quantity,
    },
    hq: {
      minListingPrice: item.hq?.minListing?.[scopeKey]?.price,
      minListingWorldId: item.hq?.minListing?.[scopeKey]?.worldId,
      recentPurchasePrice: item.hq?.recentPurchase?.[scopeKey]?.price,
      recentPurchaseTimestamp: item.hq?.recentPurchase?.[scopeKey]?.timestamp,
      recentPurchaseWorldId: item.hq?.recentPurchase?.[scopeKey]?.worldId,
      averageSalePrice: item.hq?.averageSalePrice?.[scopeKey]?.price,
      dailySaleVelocity: item.hq?.dailySaleVelocity?.[scopeKey]?.quantity,
    },
    lastUploadTime: item.worldUploadTimes?.[0]?.timestamp,
  }))
  return results
}

function normalizeTotal(raw: any) {
  const pricePerUnit = Number(raw.pricePerUnit ?? 0)
  const quantity = Number(raw.quantity ?? 0)
  const total = Number(raw.total ?? 0)
  if (Number.isFinite(total) && total > 0) return total
  if (!Number.isFinite(pricePerUnit) || !Number.isFinite(quantity)) return 0
  return pricePerUnit * quantity
}

function normalizeListing(raw: any) {
  return {
    worldName: raw.worldName ?? '',
    itemId: raw.itemID ?? raw.itemId ?? 0,
    hq: raw.hq ?? false,
    pricePerUnit: raw.pricePerUnit ?? 0,
    quantity: raw.quantity ?? 0,
    total: normalizeTotal(raw),
    retainerName: raw.retainerName ?? '',
    retainerCity: raw.retainerCity ?? '',
    lastReviewTime: raw.lastReviewTime ?? 0,
    tax: raw.tax ?? 0,
  }
}

function normalizeSale(raw: any) {
  return {
    hq: raw.hq ?? false,
    pricePerUnit: raw.pricePerUnit ?? 0,
    quantity: raw.quantity ?? 0,
    timestamp: raw.timestamp ?? 0,
    buyerName: raw.buyerName ?? '',
    total: normalizeTotal(raw),
    worldName: raw.worldName ?? '',
  }
}

function normalizeMarketData(raw: any): MarketData {
  return {
    itemId: raw.itemID ?? raw.itemId ?? 0,
    worldName: raw.worldName,
    dcName: raw.dcName,
    regionName: raw.regionName,
    lastUploadTime: raw.lastUploadTime ?? 0,
    listings: (raw.listings ?? []).map((l: any) => ({
      ...normalizeListing(l),
      worldName: l.worldName || raw.worldName || '',
    })),
    recentHistory: (raw.recentHistory ?? []).map((h: any) => ({
      ...normalizeSale(h),
      worldName: h.worldName || raw.worldName || '',
    })),
    currentAveragePrice: raw.currentAveragePrice ?? 0,
    currentAveragePriceNQ: raw.currentAveragePriceNQ ?? 0,
    currentAveragePriceHQ: raw.currentAveragePriceHQ ?? 0,
    regularSaleVelocity: raw.regularSaleVelocity ?? 0,
    nqSaleVelocity: raw.nqSaleVelocity ?? 0,
    hqSaleVelocity: raw.hqSaleVelocity ?? 0,
    averagePrice: raw.averagePrice ?? 0,
    averagePriceNQ: raw.averagePriceNQ ?? 0,
    averagePriceHQ: raw.averagePriceHQ ?? 0,
    minPrice: raw.minPrice ?? 0,
    minPriceNQ: raw.minPriceNQ ?? 0,
    minPriceHQ: raw.minPriceHQ ?? 0,
    maxPrice: raw.maxPrice ?? 0,
    maxPriceNQ: raw.maxPriceNQ ?? 0,
    maxPriceHQ: raw.maxPriceHQ ?? 0,
    stackSizeHistogram: raw.stackSizeHistogram ?? {},
    stackSizeHistogramNQ: raw.stackSizeHistogramNQ ?? {},
    stackSizeHistogramHQ: raw.stackSizeHistogramHQ ?? {},
  }
}

function normalizeHistoryData(raw: any): HistoryData {
  return {
    itemId: raw.itemID ?? raw.itemId ?? 0,
    worldName: raw.worldName,
    dcName: raw.dcName,
    regionName: raw.regionName,
    entries: (raw.entries ?? []).map((e: any) => ({
      ...normalizeSale(e),
      worldName: e.worldName ?? raw.worldName ?? '',
    })),
    lastUploadTime: raw.lastUploadTime ?? 0,
    regularSaleVelocity: raw.regularSaleVelocity ?? 0,
    nqSaleVelocity: raw.nqSaleVelocity ?? 0,
    hqSaleVelocity: raw.hqSaleVelocity ?? 0,
    averagePrice: raw.averagePrice ?? 0,
    averagePriceNQ: raw.averagePriceNQ ?? 0,
    averagePriceHQ: raw.averagePriceHQ ?? 0,
    minPrice: raw.minPrice ?? 0,
    minPriceNQ: raw.minPriceNQ ?? 0,
    minPriceHQ: raw.minPriceHQ ?? 0,
    maxPrice: raw.maxPrice ?? 0,
    maxPriceNQ: raw.maxPriceNQ ?? 0,
    maxPriceHQ: raw.maxPriceHQ ?? 0,
    stackSizeHistogram: raw.stackSizeHistogram ?? {},
    stackSizeHistogramNQ: raw.stackSizeHistogramNQ ?? {},
    stackSizeHistogramHQ: raw.stackSizeHistogramHQ ?? {},
  }
}

export async function fetchMarketData(
  worldDcRegion: string,
  itemIds: string
): Promise<Record<number, MarketData>> {
  const res = await fetchWithAbort(
    `market:${worldDcRegion}:${itemIds}`,
    `${BASE_URL}/api/v2/${encodeURIComponent(worldDcRegion)}/${itemIds}`
  )
  if (!res.ok) throw new Error('Failed to fetch market data')
  const raw: any = await res.json()
  const result: Record<number, MarketData> = {}

  if (raw && typeof raw === 'object' && 'items' in raw) {
    for (const key of Object.keys(raw.items)) {
      const item = raw.items[key]
      if (item) {
        const id = item.itemID ?? item.itemId ?? Number(key)
        result[id] = normalizeMarketData(item)
      }
    }
  } else if (raw && (raw.itemID != null || raw.itemId != null)) {
    const id = raw.itemID ?? raw.itemId
    result[id] = normalizeMarketData(raw)
  }

  return result
}

export async function fetchHistoryData(
  worldDcRegion: string,
  itemIds: string
): Promise<HistoryData> {
  const entriesWithin = 30 * 24 * 60 * 60 // 30 days
  const res = await fetchWithAbort(
    `history:${worldDcRegion}:${itemIds}`,
    `${BASE_URL}/api/v2/history/${encodeURIComponent(worldDcRegion)}/${itemIds}?entriesWithin=${entriesWithin}`
  )
  if (!res.ok) throw new Error('Failed to fetch history data')
  const raw = await res.json()
  return normalizeHistoryData(raw)
}
