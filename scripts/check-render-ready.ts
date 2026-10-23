/** Check the snapshot's final frame, including work taking longer than the old 750ms delay. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { resolve, join, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { makeReport } from '../tests/fixtures/item-report'

const dist = resolve(process.env.XIV_MARKET_DIST ?? 'app/dist')
const { chromium } = await import(pathToFileURL(join(process.env.XIV_PLAYWRIGHT_CORE!, 'index.mjs')).href)
const site = createServer((request, response) => {
  try {
    const path = resolve(dist, '.' + new URL(request.url!, 'http://localhost').pathname)
    if (!path.startsWith(dist + sep)) throw new Error('outside dist')
    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' } as Record<string,string>)[extname(path)] ?? 'application/octet-stream' })
    response.end(readFileSync(path))
  } catch { response.writeHead(404).end() }
})
await new Promise<void>(done => site.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`
const font = readFileSync(execFileSync('fc-match', ['-f', '%{file}', 'Liberation Sans'], { encoding: 'utf8' }))
const icon = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#60a5fa"/></svg>'
const browser = await chromium.launch({ headless: true })
const results: unknown[] = []
function latch() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }
try {
  for (const scenario of ['delayed-assets', 'chart-error', 'empty', 'icon-fallback'] as const) {
    const page = await browser.newPage({ viewport: { width: 1120, height: 1600 }, deviceScaleFactor: 2 })
    const gates = { chart: latch(), image: latch(), font: latch() }
    const seen = { chart: false, image: false, font: false }
    const report = makeReport(); report.item.icon = 30003
    if (scenario === 'empty') { report.market.listings = []; report.history.entries = [] }
    await page.addInitScript(({ report, origin, delayed }: any) => {
      Object.defineProperty(window, '__XIV_MARKET_REPORT__', { value: report })
      if (delayed) { const face = new FontFace('ReadinessTest', `url(${origin}/slow-font.ttf)`); document.fonts.add(face); void face.load() }
    }, { report, origin, delayed: scenario === 'delayed-assets' })
    await page.route('**/*', async (route: any) => {
      const url = new URL(route.request().url())
      if (/\/chart-[^/]+\.js$/.test(url.pathname)) {
        seen.chart = true
        if (scenario === 'delayed-assets') await gates.chart.promise
        if (scenario === 'chart-error') return route.fulfill({ status: 503, body: 'fixture failure' })
      }
      if (url.pathname === '/slow-font.ttf') { seen.font = true; await gates.font.promise; return route.fulfill({ contentType: 'font/ttf', body: font }) }
      if (route.request().resourceType() === 'image') {
        seen.image = true
        if (scenario === 'delayed-assets') await gates.image.promise
        if (scenario === 'icon-fallback' && url.origin !== origin) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ contentType: 'image/svg+xml', body: icon })
      }
      if (url.origin === origin) return route.continue()
      throw new Error('unexpected external request: ' + url)
    })
    const started = performance.now()
    await page.goto(origin + '/render.html', { waitUntil: 'domcontentloaded' })
    const root = page.locator('[data-render-root]')
    await root.waitFor()
    if (scenario === 'delayed-assets') {
      await delay(900)
      assert.deepEqual(seen, { chart: true, image: true, font: true })
      assert.equal(await root.getAttribute('data-render-ready'), 'false')
      gates.image.resolve(); gates.chart.resolve()
      await page.waitForFunction(() => [...document.querySelectorAll('canvas')].every(canvas => canvas.dataset.chartState === 'ready'))
      assert.equal(await root.getAttribute('data-render-ready'), 'false', 'fonts must also finish')
      gates.font.resolve()
    }
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-render-root]')
      return root?.getAttribute('data-render-ready') === 'true' || Boolean(root?.getAttribute('data-render-error'))
    }, undefined, { timeout: 10_000 })
    const readyMs = performance.now() - started
    if (scenario === 'chart-error') {
      assert.match(await root.getAttribute('data-render-error'), /图表/)
      assert.equal(await root.getAttribute('data-render-ready'), 'false')
    } else {
      assert.equal(await root.getAttribute('data-render-error'), null, scenario)
      const first = await root.screenshot({ animations: 'disabled' })
      // Validation only: a later frame must be byte-identical to the ready frame.
      await delay(1000)
      assert.deepEqual(await root.screenshot({ animations: 'disabled' }), first, scenario + ': ready frame was not final')
    }
    results.push({ scenario, readyMs: Math.round(readyMs), seen })
    await page.close()
  }
  console.log(JSON.stringify({ passed: results.length, results }))
} finally { await browser.close(); await new Promise<void>(done => site.close(() => done())) }
