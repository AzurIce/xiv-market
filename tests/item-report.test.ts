import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeItemReport, computeItemStats } from '../packages/shared/src/item-report'
import { createWorldDirectory } from '../packages/shared/src/world-directory'
import { makeReport, fixtureNow } from './fixtures/item-report'

test('Injected report data uses the web normalizers, preserving units and total/world fallbacks', () => {
  const wire = makeReport('宇宙和音')
  wire.market.worldName = '宇宙和音'
  wire.market.listings = [{ pricePerUnit: 50, quantity: 3, hq: false, lastReviewTime: 123 }]
  wire.history.worldName = '宇宙和音'
  wire.history.entries = [{ pricePerUnit: 40, quantity: 2, hq: false, timestamp: 456 }]
  const result = normalizeItemReport(wire)
  assert.equal(result.market.listings[0].total, 150)
  assert.equal(result.market.listings[0].worldName, '宇宙和音')
  assert.equal(result.history.entries[0].worldName, '宇宙和音')
  assert.equal(result.market.lastUploadTime, fixtureNow - 600000)
  assert.equal(result.market.listings[0].lastReviewTime, 123)
  assert.equal(result.history.entries[0].timestamp, 456)
})

test('report statistics keep qualities separate, the existing percentile rule and API velocities', () => {
  const report = normalizeItemReport(makeReport())
  const rows = report.market.listings.filter(row => row.worldName === '红玉海')
  const stats = computeItemStats(report.market, rows, true)!
  assert.equal(stats.nqMinListing?.pricePerUnit, 100)
  assert.equal(stats.hqMinListing?.pricePerUnit, 1000)
  assert.deepEqual(stats.nqDist, { min: 100, p25: 110, p50: 130, p75: 150 })
  assert.equal(stats.listingCount, 16)
  assert.equal(stats.nqVelocity, 120)
  assert.equal(stats.hqVelocity, 180)
  assert.equal(stats.velocity, 300)
  assert.equal(computeItemStats(null, [], true), null)
})

test('each report filters region/DC/world with its own directory; missing metadata preserves rows', () => {
  const report = normalizeItemReport(makeReport())
  const directory = createWorldDirectory(report.dataCenters, report.worlds)
  assert.equal(directory.filterRows(report.market.listings, '中国').length, 48)
  assert.equal(directory.filterRows(report.market.listings, '陆行鸟').length, 32)
  assert.equal(directory.filterRows(report.market.listings, '宇宙和音').length, 16)
  const other = createWorldDirectory([{ name: '另一个大区', region: '中国', worlds: [1177] }], report.worlds)
  assert.equal(other.dcNameByWorldName('宇宙和音'), '另一个大区')
  assert.equal(directory.dcNameByWorldName('宇宙和音'), '陆行鸟')
  assert.equal(createWorldDirectory([], []).filterRows(report.market.listings, '宇宙和音').length, 48)
})

test('incompatible injected data fails instead of requesting replacement data', () => {
  const report = makeReport()
  for (const value of [undefined, { ...report, schemaVersion: 2 },
    { ...report, history: { ...report.history, itemID: 6 } }]) {
    assert.throws(() => normalizeItemReport(value))
  }
})

test('quality parsing and filtering keep NQ/HQ distinct regardless of availability', async () => {
  const { parseMarketQuality, filterMarketQuality } = await import('../packages/shared/src/item-report')
  assert.equal(parseMarketQuality('NQ'), 'nq')
  assert.equal(parseMarketQuality('hq'), 'hq')
  assert.equal(parseMarketQuality('other'), undefined)
  const report = normalizeItemReport(makeReport())
  const nq = filterMarketQuality(report.market.listings, 'nq')
  assert.equal(nq.length, 24)
  assert.ok(nq.every(row => !row.hq && row.pricePerUnit < 1000))
  assert.deepEqual(filterMarketQuality(nq, 'hq'), [])
  assert.ok(filterMarketQuality(report.history.entries, 'hq').every(row => row.hq))
})

test('non-HQ item statistics ignore impossible HQ listings and velocity', () => {
  const report = normalizeItemReport(makeReport())
  const stats = computeItemStats(report.market, report.market.listings, false)!
  assert.equal(stats.hqDist, null)
  assert.equal(stats.hqMinListing, null)
  assert.equal(stats.hqVelocity, 0)
  assert.equal(stats.listingCount, 24)
})
