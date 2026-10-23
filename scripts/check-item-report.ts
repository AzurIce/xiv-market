/** Bun + Playwright: compare the actual web and injected snapshot views. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, join, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { makeReport, fixtureNow } from '../tests/fixtures/item-report'

const sourceDist = resolve(process.env.XIV_MARKET_DIST ?? 'app/dist')
// Keep other builds in the shared workspace from changing assets mid-check.
const dist = mkdtempSync(join(tmpdir(), 'xiv-market-check-dist-'))
cpSync(sourceDist, dist, { recursive: true })
const baseline = process.env.REPORT_BASELINE_DIST && resolve(process.env.REPORT_BASELINE_DIST)
const output = resolve(process.env.REPORT_CHECK_OUTPUT ?? '/tmp/xiv-market-report-check')
mkdirSync(output, { recursive: true })
assert.ok(process.env.XIV_PLAYWRIGHT_CORE, 'set XIV_PLAYWRIGHT_CORE to playwright-core')
const { chromium } = await import(pathToFileURL(join(process.env.XIV_PLAYWRIGHT_CORE!, 'index.mjs')).href)
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' }
const site = createServer((req, res) => {
  try {
    const url = new URL(req.url!, 'http://localhost')
    const old = url.pathname.startsWith('/baseline/')
    const root = old ? baseline! : dist
    const path = old ? url.pathname.slice('/baseline'.length) : url.pathname
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path))
    if (!file.startsWith(root + sep)) throw new Error('outside dist')
    let body = readFileSync(file)
    if (old && extname(file) === '.html') body = Buffer.from(body.toString().replaceAll('"/assets/', '"/baseline/assets/'))
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404).end() }
})
await new Promise<void>(done => site.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`
const autoChunk = readdirSync(join(dist, 'assets')).find(name => /^auto-.*\.js$/.test(name))!
const oldAuto = baseline && readdirSync(join(baseline, 'assets')).find(name => /^auto-.*\.js$/.test(name))
const titles = ['最低挂单 · 价格分布', '挂单价格分布', '交易走势']
const browser = await chromium.launch({ headless: true })
const results: unknown[] = []
const digest = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

async function open(mode: 'web' | 'snapshot' | 'baseline', report = makeReport(), failHistory = false, quality?: 'nq' | 'hq') {
  const page = await browser.newPage({ viewport: { width: 1120, height: 1600 }, deviceScaleFactor: 2, timezoneId: 'Asia/Shanghai' })
  const errors: string[] = [], dataRequests: string[] = []
  const faults = { market: false, history: failHistory }
  page.on('pageerror', (e: Error) => errors.push(e.message))
  await page.addInitScript(({ now, report, mode }: any) => {
    const NativeDate = Date
    globalThis.Date = new Proxy(NativeDate, {
      construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [now], newTarget) },
      get(target, key, receiver) { return key === 'now' ? () => now : Reflect.get(target, key, receiver) },
    })
    localStorage.setItem('xiv_region', mode === 'baseline' ? report.scope : '中国')
    if (mode === 'snapshot') Object.defineProperty(globalThis, '__XIV_MARKET_REPORT__', { value: report })
  }, { now: fixtureNow, report, mode })
  await page.route('**/*', async (route: any) => {
    const url = new URL(route.request().url())
    const path = decodeURIComponent(url.pathname)
    if (url.hostname === 'universalis.app' || path.endsWith('/items.json')) {
      dataRequests.push(url.href)
      if (mode === 'snapshot') return route.abort()
      if (path.endsWith('/items.json')) return route.fulfill({ json: { [report.itemId]: report.item } })
      if (path === '/api/v2/data-centers') return route.fulfill({ json: report.dataCenters })
      if (path === '/api/v2/worlds') return route.fulfill({ json: report.worlds })
      if (path.startsWith('/api/v2/history/')) return faults.history
        ? route.fulfill({ status: 502, json: { error: 'fixture failure' } }) : route.fulfill({ json: report.history })
      if (path.startsWith('/api/v2/')) return faults.market
        ? route.fulfill({ status: 502, json: { error: 'fixture failure' } }) : route.fulfill({ json: report.market })
      throw new Error('unexpected data request: ' + url.href)
    }
    if (url.origin === origin) return route.continue()
    return route.abort()
  })
  const qualityParam = quality ? `quality=${quality}` : ''
  const path = mode === 'snapshot' ? `/render.html?${qualityParam}`
    : `${mode === 'baseline' ? '/baseline' : ''}/#/item/${report.itemId}?scope=${encodeURIComponent(report.scope)}&${qualityParam}`
  await page.goto(origin + path, { waitUntil: 'networkidle' })
  try {
    await page.getByText(report.market.listings.length ? titles[0] : '暂无挂单数据', { exact: true }).first().waitFor({ timeout: 8000 })
  } catch (error) {
    process.stderr.write(JSON.stringify({ mode, quality, scope: report.scope, errors, dataRequests, body: (await page.locator('body').innerText()).slice(0, 1800) }) + '\n')
    throw error
  }
  if (failHistory) await page.getByText('历史成交加载失败', { exact: true }).waitFor()
  const chunk = mode === 'baseline' ? `/baseline/assets/${oldAuto}` : `/assets/${autoChunk}`
  await page.waitForFunction(async (url: string) => {
    const { default: Chart } = await import(url)
    return [...document.querySelectorAll('canvas')].every(canvas => Boolean(Chart.getChart(canvas)))
  }, origin + chunk)
  await page.evaluate(async (url: string) => {
    const { default: Chart } = await import(url)
    for (const canvas of document.querySelectorAll('canvas')) {
      const chart = Chart.getChart(canvas)
      chart?.stop(); chart?.update('none')
    }
    await document.fonts.ready
    window.scrollTo(0, 0)
  }, origin + chunk)
  await page.waitForTimeout(350) // let ResizeObserver and opacity transitions settle
  return { page, errors, dataRequests, faults }
}

function section(page: any, title: string) {
  if (title === titles[0]) return page.locator('.max-w-7xl > [data-slot="card"]').first()
  return page.getByText(title, { exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]')
}

async function capture(page: any, title: string) {
  // Different outer headers put cards at different fractional CSS coordinates.
  // Align their origins before comparing rasterized rounded borders and glyphs.
  const card = section(page, title)
  const style = await page.addStyleTag({ content: '[class*="sticky"], nav { visibility: hidden !important; }' })
  await style.evaluate((element: HTMLElement) => element.dataset.reportCheck = 'true')
  await card.scrollIntoViewIfNeeded()
  const box = await card.boundingBox()
  await card.evaluate((element: HTMLElement, offset: { x: number; y: number }) => {
    element.style.transform = `translate(${offset.x}px, ${offset.y}px)`
  }, { x: Math.ceil(box.x) - box.x, y: Math.ceil(box.y) - box.y })
  return card.screenshot({ animations: 'disabled' })
}


async function comparePixels(page: any, a: Buffer, b: Buffer, label: string) {
  if (a.equals(b)) return { identicalPng: true, differentPixels: 0, totalPixels: a.readUInt32BE(16) * a.readUInt32BE(20), maxChannelDelta: 0 }
  const diff = await page.evaluate(async ({ a, b }: { a: string; b: string }) => {
    async function decode(value: string) {
      const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      return { width: bitmap.width, height: bitmap.height, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data }
    }
    const aa = await decode(a), bb = await decode(b)
    if (aa.width !== bb.width || aa.height !== bb.height) throw new Error('image dimensions changed')
    let differentPixels = 0, maxChannelDelta = 0
    for (let i = 0; i < aa.data.length; i += 4) {
      let differs = false
      for (let c = 0; c < 4; c++) {
        const delta = Math.abs(aa.data[i + c] - bb.data[i + c])
        if (delta) differs = true
        maxChannelDelta = Math.max(maxChannelDelta, delta)
      }
      if (differs) differentPixels++
    }
    return { differentPixels, totalPixels: aa.width * aa.height, maxChannelDelta }
  }, { a: a.toString('base64'), b: b.toString('base64') })
  // Chromium compositing may slightly change rounded-border antialiasing under
  // different page shells. Text and geometry are checked separately below.
  assert.ok(diff.differentPixels / diff.totalPixels <= 0.0001 && diff.maxChannelDelta <= 32,
    `${label}: visual difference ${JSON.stringify(diff)} (see ${output})`)
  return diff
}

try {
  for (const name of ['region', 'dc', 'world', 'nq-only', 'hq-only', 'empty']) {
    const report = makeReport(name === 'dc' ? '陆行鸟' : name === 'world' ? '宇宙和音' : '中国')
    if (name === 'nq-only' || name === 'hq-only') {
      const hq = name === 'hq-only'
      report.market.listings = report.market.listings.filter((row: any) => row.hq === hq)
      report.history.entries = report.history.entries.filter((row: any) => row.hq === hq)
    }
    if (name === 'empty') { report.market.listings = []; report.history.entries = [] }
    const opened = new Map<string, Awaited<ReturnType<typeof open>>>()
    const compareBaseline = Boolean(baseline && ['region', 'dc', 'world'].includes(name))
    const quality = name === 'nq-only' ? 'nq' : 'hq'
    for (const mode of compareBaseline ? ['baseline', 'web', 'snapshot'] as const : ['web', 'snapshot'] as const) {
      const result = await open(mode, report, false, quality)
      opened.set(mode, result)
      assert.deepEqual(result.errors, [], `${name}/${mode}: browser error`)
      if (mode === 'snapshot') {
        assert.deepEqual(result.dataRequests, [], 'injected snapshot attempted to fetch data')
        assert.equal(await result.page.getByText('当前挂单', { exact: true }).count(), 0)
      }
    }
    const images: Record<string, unknown> = {}
    for (const title of titles) {
      const web = await capture(opened.get('web')!.page, title)
      const snapshot = await capture(opened.get('snapshot')!.page, title)
      const key = `${name}-${titles.indexOf(title)}`
      writeFileSync(join(output, key + '-web.png'), web)
      writeFileSync(join(output, key + '-snapshot.png'), snapshot)
      assert.equal(await section(opened.get('snapshot')!.page, title).innerText(), await section(opened.get('web')!.page, title).innerText())
      const snapshotDiff = await comparePixels(opened.get('web')!.page, web, snapshot, key)
      let baselineDiff
      if (compareBaseline) {
        const old = await capture(opened.get('baseline')!.page, title)
        writeFileSync(join(output, key + '-baseline.png'), old)
        assert.equal(await section(opened.get('baseline')!.page, title).innerText(), await section(opened.get('web')!.page, title).innerText())
        baselineDiff = await comparePixels(opened.get('web')!.page, old, web, `${key}/baseline`)
      }
      images[title] = { sha256: digest(web), snapshotDiff, baselineDiff }
    }
    if (name === 'region') {
      await opened.get('snapshot')!.page.locator('[data-render-root]').screenshot({ path: join(output, 'report.png'), animations: 'disabled' })
      // Both entry points retain the same quality interaction, not just the first frame.
      for (const mode of ['web', 'snapshot']) {
        const page = opened.get(mode)!.page
        await page.locator('style[data-report-check]').evaluateAll((styles: Element[]) => styles.forEach(style => style.remove()))
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.getByRole('button', { name: '切换 NQ/HQ 品质筛选', exact: true }).filter({ visible: true }).click()
        await page.waitForFunction(() => document.querySelector('[data-item-report]')?.getAttribute('data-quality') === 'nq')
      }
      const webText = await section(opened.get('web')!.page, titles[1]).innerText()
      assert.equal(await section(opened.get('snapshot')!.page, titles[1]).innerText(), webText)
    }
    results.push({ case: name, images, snapshotDataRequests: 0, baselineCompared: compareBaseline })
    for (const result of opened.values()) await result.page.close()
  }
  // Explicit quality is independent of what is currently listed; history can
  // contain the other quality even when all listings are of a single quality.
  for (const qualityCase of ['explicit-nq', 'hq-unavailable', 'nq-unavailable', 'single-quality-listings', 'non-hq-item']) {
    const report = makeReport()
    let quality: 'nq' | 'hq' | undefined = qualityCase === 'explicit-nq' || qualityCase === 'nq-unavailable' ? 'nq' : 'hq'
    if (qualityCase === 'hq-unavailable') {
      report.market.listings = report.market.listings.filter((row: any) => !row.hq)
      report.history.entries = report.history.entries.filter((row: any) => !row.hq)
    }
    if (qualityCase === 'nq-unavailable') {
      report.market.listings = report.market.listings.filter((row: any) => row.hq)
      report.history.entries = report.history.entries.filter((row: any) => row.hq)
    }
    if (qualityCase === 'single-quality-listings') report.market.listings = report.market.listings.filter((row: any) => row.hq)
    if (qualityCase === 'non-hq-item') { report.item.canBeHq = false; quality = undefined }
    const expected = qualityCase === 'non-hq-item' ? 'nq' : quality!
    for (const mode of ['web', 'snapshot'] as const) {
      // Omitting quality on the NQ-only snapshot checks the bot's default HQ
      // behavior; the web URL requests the same HQ view explicitly.
      const result = await open(mode, report, false, mode === 'snapshot' && qualityCase === 'hq-unavailable' ? undefined : quality)
      assert.equal(await result.page.locator('[data-item-report]').getAttribute('data-quality'), expected)
      if (qualityCase.endsWith('-unavailable')) {
        assert.ok(await section(result.page, titles[1]).getByText('暂无挂单数据', { exact: true }).isVisible())
        assert.ok(await section(result.page, titles[2]).getByText('暂无成交记录', { exact: true }).isVisible())
        assert.equal(await result.page.locator('canvas').count(), 0)
      } else {
        const prices = await result.page.evaluate(async (url: string) => {
          const { default: Chart } = await import(url)
          const canvas = document.querySelector('canvas')!
          return Chart.getChart(canvas).data.datasets.find((dataset: any) => dataset.label === '均价').data
        }, `${origin}/assets/${autoChunk}`)
        assert.ok(prices.length > 0)
        assert.ok(prices.every((price: number) => expected === 'nq' ? price < 500 : price >= 900), `${qualityCase}: mixed prices`)
      }
      if (qualityCase === 'non-hq-item') {
        assert.equal(await result.page.getByRole('button', { name: '切换 NQ/HQ 品质筛选', exact: true }).count(), 0)
        assert.equal(await section(result.page, titles[0]).getByText('HQ', { exact: true }).count(), 0)
      }
      if (mode === 'snapshot') assert.deepEqual(result.dataRequests, [])
      else assert.ok(result.dataRequests.some(url => decodeURIComponent(new URL(url).pathname) === `/api/v2/${report.scope}/${report.itemId}`))
      assert.deepEqual(result.errors, [])
      await result.page.close()
    }
    results.push({ case: qualityCase, quality: expected, strictQuality: true, snapshotDataRequests: 0 })
  }
  const navigation = await open('web', makeReport(), false, 'hq')
  await navigation.page.evaluate(() => {
    window.location.hash = '/item/5?scope=' + encodeURIComponent('宇宙和音') + '&quality=nq'
  })
  await navigation.page.waitForFunction(() => document.querySelector('[data-item-report]')?.getAttribute('data-quality') === 'nq')
  await section(navigation.page, titles[0]).getByText('16', { exact: true }).waitFor()
  await navigation.page.evaluate(() => { window.location.hash = '/item/5?quality=nq' })
  await section(navigation.page, titles[0]).getByText('48', { exact: true }).waitFor()
  assert.deepEqual(navigation.errors, [])
  await navigation.page.close()
  results.push({ case: 'web-url-navigation', scopeAndQualitySynced: true, scopeRemovalRestoresRegion: true })
  const failed = await open('web', makeReport(), true)
  assert.deepEqual(failed.errors, [])
  assert.ok(await section(failed.page, titles[0]).isVisible())
  await failed.page.getByRole('button', { name: '刷新' }).first().click()
  await failed.page.close()
  results.push({ case: 'history-failure', statsRetained: true, retryAvailable: true })
  const refresh = await open('web')
  const previousStats = await section(refresh.page, titles[0]).innerText()
  refresh.faults.market = true
  refresh.faults.history = true
  await refresh.page.getByRole('button', { name: '刷新数据', exact: true }).first().click()
  await refresh.page.getByText(/市场数据请求失败/).first().waitFor()
  assert.equal(await section(refresh.page, titles[0]).innerText(), previousStats)
  assert.ok(await section(refresh.page, titles[2]).isVisible())
  assert.deepEqual(refresh.errors, [])
  await refresh.page.close()
  results.push({ case: 'refresh-failure', staleDataRetained: true, errorToast: true })
  writeFileSync(join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  process.stdout.write(JSON.stringify({ passed: results.length, output, baselineCompared: Boolean(baseline) }) + '\n')
} finally {
  await browser.close()
  await new Promise<void>(done => site.close(() => done()))
  rmSync(dist, { recursive: true, force: true })
}
