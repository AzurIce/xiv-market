import type { MarketData, HistoryData } from './types'

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

export function normalizeMarketData(raw: any): MarketData {
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

export function normalizeHistoryData(raw: any): HistoryData {
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
