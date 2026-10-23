import type { DataCenter, World, MarketData, HistoryData, Listing } from './types'
import type { ItemInfo } from './items'
import { normalizeMarketData, normalizeHistoryData } from './market-normalize'

export type MarketQuality = 'nq' | 'hq'

export function parseMarketQuality(value: unknown): MarketQuality | undefined {
  if (typeof value !== 'string') return undefined
  const quality = value.toLowerCase()
  return quality === 'nq' || quality === 'hq' ? quality : undefined
}

export function filterMarketQuality<T extends { hq: boolean }>(rows: T[], quality: MarketQuality): T[] {
  return rows.filter(row => Boolean(row.hq) === (quality === 'hq'))
}

/** Versioned external JSON transport; normalization is shared with browser fetches. */
export interface ItemReportData {
  schemaVersion: 1
  itemId: number
  scope: string
  fetchedAtMs: number
  item: ItemInfo
  dataCenters: DataCenter[]
  worlds: World[]
  market: Record<string, unknown> & { itemID: number; listings: unknown[] }
  history: Record<string, unknown> & { itemID: number; entries: unknown[] }
  historyCoverage: {
    requestedWindowSeconds: number
    requestedLimit: number
    returnedEntries: number
    earliestTimestamp: number | null
    latestTimestamp: number | null
    possiblyTruncated: boolean
  }
}

export function normalizeItemReport(value: unknown) {
  const report = value as ItemReportData | undefined
  if (!report || report.schemaVersion !== 1 || !Number.isInteger(report.itemId) || report.itemId < 1 ||
      typeof report.scope !== 'string' || !report.scope || !Number.isFinite(report.fetchedAtMs) ||
      typeof report.item?.name !== 'string' || !Array.isArray(report.dataCenters) || !Array.isArray(report.worlds) ||
      report.market?.itemID !== report.itemId || report.history?.itemID !== report.itemId ||
      !Array.isArray(report.market.listings) || !Array.isArray(report.history.entries)) {
    throw new Error('报表数据不完整或版本不匹配')
  }
  return {
    ...report,
    market: normalizeMarketData(report.market),
    history: normalizeHistoryData(report.history),
  }
}

export function percentile(sortedValues: number[], ratio: number): number {
  if (!sortedValues.length) return 0
  return sortedValues[Math.floor((sortedValues.length - 1) * ratio)]
}

/** The live page's NQ/HQ statistics, also used by image exports. */
export function computeItemStats(data: MarketData | null, listings: Listing[], canBeHq: boolean) {
  if (!data) return null
  if (!canBeHq) listings = filterMarketQuality(listings, 'nq')
  const priceOf = (listing: Listing) => Number(listing.pricePerUnit ?? 0)
  const isValid = (listing: Listing) => Number.isFinite(priceOf(listing)) && priceOf(listing) > 0
  const byPriceAsc = (a: Listing, b: Listing) =>
    Number(a.pricePerUnit) - Number(b.pricePerUnit) || Number(a.total ?? 0) - Number(b.total ?? 0)
  const minListingOf = (hq: boolean) =>
    listings.filter(l => isValid(l) && Boolean(l.hq) === hq).slice().sort(byPriceAsc)[0] ?? null
  const distOf = (hq: boolean) => {
    const sorted = listings.filter(l => isValid(l) && Boolean(l.hq) === hq).map(priceOf).sort((a, b) => a - b)
    if (!sorted.length) return null
    return { min: sorted[0], p25: percentile(sorted, 0.25), p50: percentile(sorted, 0.5), p75: percentile(sorted, 0.75) }
  }
  return {
    velocity: data.regularSaleVelocity,
    nqVelocity: data.nqSaleVelocity,
    hqVelocity: canBeHq ? data.hqSaleVelocity : 0,
    lastUploadTime: data.lastUploadTime,
    listingCount: listings.length,
    nqMinListing: minListingOf(false),
    hqMinListing: minListingOf(true),
    nqDist: distOf(false),
    hqDist: distOf(true),
  }
}

export type ReportQueryState<T> = {
  // undefined = not loaded for this query; null = a successful empty result.
  data: T | undefined
  loading: boolean
  error: string | null
  retry?: () => void
}

export type ItemReportMarketState = ReportQueryState<MarketData | null>
export type ItemReportHistoryState = ReportQueryState<HistoryData>
