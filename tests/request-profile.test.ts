import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { fetchJsonWithTimeout } from '../packages/shared/src/async'
import { clearRequestTraces, requestTraces } from '../packages/shared/src/request-profile'
import { resourceDetails } from '../packages/ui/src/debug/performance'
import { firstAvailable } from '../packages/shared/src/first-available'

test('JSON requests record body bytes, status and phases without retaining response data', async () => {
  clearRequestTraces()
  const body = JSON.stringify({ name: '火之碎晶' })
  const hash = createHash('sha256').update(body).digest('hex')
  const data = await fetchJsonWithTimeout(`data:application/json,${encodeURIComponent(body)}`, 'test', undefined, { purpose: 'probe', cache: 'no-store', sha256: hash })
  assert.deepEqual(data, { name: '火之碎晶' })
  const trace = requestTraces().at(-1)!
  assert.equal(trace.status, 'success')
  assert.equal(trace.httpStatus, 200)
  assert.equal(trace.bytes, Buffer.byteLength(body))
  assert.equal(trace.cache, 'no-store')
  assert.equal(trace.purpose, 'probe')
  for (const phase of [trace.waitMs, trace.readMs, trace.parseMs, trace.verifyMs]) assert.ok(phase! >= 0)
  assert.ok(trace.end! >= trace.start)
  assert.equal('data' in trace, false)
})

test('corrupt and invalid JSON responses are visible as failed requests', async () => {
  await assert.rejects(fetchJsonWithTimeout('data:application/json,%7B%7D', 'test', undefined, { sha256: '0'.repeat(64) }), /版本校验失败/)
  assert.equal(requestTraces().at(-1)?.status, 'error')
  await assert.rejects(fetchJsonWithTimeout('data:application/json,invalid', 'test'))
  assert.equal(requestTraces().at(-1)?.status, 'error')
})

test('cancellation includes stalled response bodies and records an aborted request', async () => {
  let received!: () => void
  const started = new Promise<void>(resolve => { received = resolve })
  const server = Bun.serve({ port: 0, fetch() {
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); received() } }))
  } })
  try {
    const controller = new AbortController()
    const result = fetchJsonWithTimeout(`http://localhost:${server.port}`, 'test', controller.signal)
    await started
    controller.abort()
    await assert.rejects(result, error => error instanceof DOMException && error.name === 'AbortError')
    assert.equal(requestTraces().at(-1)?.status, 'aborted')
  } finally { server.stop(true) }
})

test('cross-origin redaction is unknown rather than zero latency or a cache hit', () => {
  const entry = { name: 'https://tos.example/object', startTime: 20, duration: 500, requestStart: 0, responseStart: 0, transferSize: 0, decodedBodySize: 0 } as PerformanceResourceTiming
  const details = resourceDetails(entry)
  assert.equal(details.duration, 500)
  for (const field of ['dns', 'connect', 'tls', 'ttfb', 'transfer', 'cached'] as const) assert.equal(details[field], null)
})

test('a primary that stalls after its headers loses to the backup and stops reading', async () => {
  let primaryFinished!: () => void
  const stopped = new Promise<void>(resolve => { primaryFinished = resolve })
  const server = Bun.serve({ port: 0, fetch(request) {
    if (new URL(request.url).pathname === '/backup') return Response.json({ loaded: true })
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')) } }))
  } })
  try {
    const base = `http://localhost:${server.port}`
    const result = await firstAvailable([
      { id: 'primary', label: 'Primary', url: `${base}/primary` },
      { id: 'backup', label: 'Backup', url: `${base}/backup` },
    ], async (source, signal) => {
      try { return await fetchJsonWithTimeout(source.url, 'test', signal) }
      finally { if (source.id === 'primary') primaryFinished() }
    }, { delayMs: 15 })
    await stopped
    assert.equal(result.source.id, 'backup')
    const primary = requestTraces().findLast(trace => trace.url === `${base}/primary`)!
    assert.equal(primary.status, 'aborted')
    assert.ok(primary.waitMs! >= 0)
    assert.equal(primary.bytes, undefined)
  } finally { server.stop(true) }
})
