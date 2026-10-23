import type { ItemReportData } from '../../packages/shared/src/item-report'

export const fixtureNow = Date.parse('2026-10-23T01:00:00Z')

export function makeReport(scope = '中国'): ItemReportData {
  const worlds = [{ id: 1167, name: '红玉海' }, { id: 1177, name: '宇宙和音' }, { id: 1200, name: '紫水栈桥' }]
  const dataCenters = [
    { name: '陆行鸟', region: '中国', worlds: [1167, 1177] },
    { name: '猫小胖', region: '中国', worlds: [1200] },
  ]
  const listings = worlds.flatMap((world, w) => [false, true].flatMap(hq =>
    Array.from({ length: 8 }, (_, i) => ({
      pricePerUnit: (hq ? 1000 : 100) + w * 50 + i * 10,
      quantity: i + 1, total: 0, hq, worldName: world.name,
      retainerName: `测试雇员 ${w}-${i}`, lastReviewTime: fixtureNow / 1000 - i * 60,
    }))))
  const entries = worlds.flatMap((world, w) => [false, true].flatMap(hq =>
    Array.from({ length: 28 }, (_, i) => ({
      pricePerUnit: (hq ? 980 : 90) + w * 50 + i * 4,
      quantity: i + 1, hq, worldName: world.name,
      timestamp: fixtureNow / 1000 - i * 86400, buyerName: `测试买家 ${i}`,
    }))))
  return {
    schemaVersion: 1, itemId: 5, scope, fetchedAtMs: fixtureNow,
    item: { name: '测试双品质物品', icon: 0, canBeHq: true }, dataCenters, worlds,
    market: { itemID: 5, lastUploadTime: fixtureNow - 600000, listings, recentHistory: entries.slice(0, 5),
      regularSaleVelocity: 300, nqSaleVelocity: 120, hqSaleVelocity: 180 },
    history: { itemID: 5, lastUploadTime: fixtureNow - 600000, entries },
    historyCoverage: { requestedWindowSeconds: 2592000, requestedLimit: 1800, returnedEntries: entries.length,
      earliestTimestamp: fixtureNow / 1000 - 27 * 86400, latestTimestamp: fixtureNow / 1000, possiblyTruncated: false },
  }
}
