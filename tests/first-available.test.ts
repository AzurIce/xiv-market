import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstAvailable } from '../packages/shared/src/first-available'

const sources = [
  { id: 'tos', label: 'TOS', url: 'https://tos.example/items.json' },
  { id: 'github', label: 'GitHub Pages', url: '/items/hash.json' },
]

test('a fast primary avoids downloading the backup', async () => {
  const called: string[] = []
  const result = await firstAvailable(sources, async source => { called.push(source.id); return 'ok' }, { delayMs: 20 })
  assert.equal(result.source.id, 'tos')
  assert.deepEqual(called, ['tos'])
})

test('a stalled primary starts the backup and is cancelled when the backup wins', async () => {
  let aborted = false
  const result = await firstAvailable(sources, (source, signal) => source.id === 'github'
    ? Promise.resolve('backup') : new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason) })), { delayMs: 10 })
  assert.equal(result.source.id, 'github')
  assert.equal(result.data, 'backup')
  assert.equal(aborted, true)
})

test('primary HTTP, parsing or integrity failures try the backup immediately', async () => {
  const result = await firstAvailable(sources, async source => {
    if (source.id === 'tos') throw new Error('Invalid checksum')
    return 'valid'
  }, { delayMs: 60_000 })
  assert.equal(result.source.id, 'github')
})

test('a failed backup does not discard a still-running primary', async () => {
  const result = await firstAvailable(sources, async source => {
    if (source.id === 'github') throw new Error('404')
    await new Promise(resolve => setTimeout(resolve, 30))
    return 'primary'
  }, { delayMs: 5 })
  assert.equal(result.data, 'primary')
})

test('all failures preserve the cause from each source', async () => {
  await assert.rejects(firstAvailable(sources, async source => { throw new Error(source.id === 'tos' ? 'timeout' : '404') }), /TOS：timeout；GitHub Pages：404/)
})

test('parent cancellation aborts work and prevents later backup requests', async () => {
  const parent = new AbortController()
  let called = 0, aborted = false
  const result = firstAvailable(sources, (_, signal) => {
    called++
    return new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason) }))
  }, { signal: parent.signal, delayMs: 100 })
  await Promise.resolve()
  parent.abort()
  await assert.rejects(result, error => error instanceof DOMException && error.name === 'AbortError')
  assert.equal(called, 1)
  assert.equal(aborted, true)
  await assert.rejects(firstAvailable(sources, async () => { called++; return 'unused' }, { signal: parent.signal }), /abort/i)
  assert.equal(called, 1)
})
