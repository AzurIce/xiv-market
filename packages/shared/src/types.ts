export interface DataCenter {
  name: string
  region: string
  worlds: number[]
}

export interface World {
  id: number
  name: string
}

export interface Listing {
  worldName: string
  itemId: number
  hq: boolean
  pricePerUnit: number
  quantity: number
  total: number
  retainerName: string
  retainerCity: string
  lastReviewTime: number
  tax: number
  creatorName?: string
  creatorId?: string
  stainId?: number
  materia?: unknown[]
}

export interface Sale {
  hq: boolean
  pricePerUnit: number
  quantity: number
  timestamp: number
  buyerName: string
  total: number
  worldName?: string
}

export interface MarketData {
  itemId: number
  worldName?: string
  dcName?: string
  regionName?: string
  lastUploadTime: number
  listings: Listing[]
  recentHistory: Sale[]
  currentAveragePrice: number
  currentAveragePriceNQ: number
  currentAveragePriceHQ: number
  regularSaleVelocity: number
  nqSaleVelocity: number
  hqSaleVelocity: number
  averagePrice: number
  averagePriceNQ: number
  averagePriceHQ: number
  minPrice: number
  minPriceNQ: number
  minPriceHQ: number
  maxPrice: number
  maxPriceNQ: number
  maxPriceHQ: number
  stackSizeHistogram: Record<string, number>
  stackSizeHistogramNQ: Record<string, number>
  stackSizeHistogramHQ: Record<string, number>
}

export interface HistoryData {
  itemId: number
  worldName?: string
  dcName?: string
  regionName?: string
  entries: Sale[]
  lastUploadTime: number
  regularSaleVelocity: number
  nqSaleVelocity: number
  hqSaleVelocity: number
  averagePrice: number
  averagePriceNQ: number
  averagePriceHQ: number
  minPrice: number
  minPriceNQ: number
  minPriceHQ: number
  maxPrice: number
  maxPriceNQ: number
  maxPriceHQ: number
  stackSizeHistogram: Record<string, number>
  stackSizeHistogramNQ: Record<string, number>
  stackSizeHistogramHQ: Record<string, number>
}

export interface AggregatedItemData {
  itemId: number
  nq: {
    minListingPrice?: number
    minListingWorldId?: number
    recentPurchasePrice?: number
    recentPurchaseTimestamp?: number
    recentPurchaseWorldId?: number
    averageSalePrice?: number
    dailySaleVelocity?: number
  }
  hq: {
    minListingPrice?: number
    minListingWorldId?: number
    recentPurchasePrice?: number
    recentPurchaseTimestamp?: number
    recentPurchaseWorldId?: number
    averageSalePrice?: number
    dailySaleVelocity?: number
  }
  lastUploadTime?: number
}
