import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { getItemsSource } from '../scripts/prepare-items'

function fixture(run: (root: string, digest: string, bytes: string) => void, prefix = '') {
  const root = mkdtempSync(join(tmpdir(), 'xiv-market-items-'))
  const bytes = '{"2":{"name":"火之碎晶","icon":20001}}'
  const digest = createHash('sha256').update(bytes).digest('hex')
  mkdirSync(join(root, '.shadow/refs/data'), { recursive: true })
  mkdirSync(join(root, 'data'))
  writeFileSync(join(root, 'shadow.toml'), `version = 1
name = "xiv-market"
[backend]
type = "volcengine_tos"
endpoint = "https://tos-cn-beijing.volces.com"
region = "cn-beijing"
bucket = "azurice-shadow"
prefix = "${prefix}"
`)
  writeFileSync(join(root, '.shadow/refs/data/items.json.ref'), `version = 1\noid = "sha256:${digest}"\nsize = ${Buffer.byteLength(bytes)}\n`)
  writeFileSync(join(root, 'data/items-version.json'), JSON.stringify({ commit: 'upstream', date: '2026/9/8' }))
  try { run(root, digest, bytes) } finally { rmSync(root, { recursive: true, force: true }) }
}

test('a fresh checkout builds a pinned TOS URL without restoring files or credentials', () => {
  fixture((root, digest) => {
    assert.deepEqual(getItemsSource(root), {
      url: `https://azurice-shadow.tos-cn-beijing.volces.com/xiv-market/objects/sha256/${digest.slice(0, 2)}/${digest.slice(2)}`,
      sha256: digest,
      size: Buffer.byteLength('{"2":{"name":"火之碎晶","icon":20001}}'),
      commit: 'upstream',
      date: '2026/9/8',
    })
  })
})

test('the URL includes the configured storage prefix', () => {
  fixture((root) => {
    assert.ok(getItemsSource(root).url.includes('/shadow/public/xiv-market/objects/sha256/'))
  }, 'shadow/public')
})

test('unpublished edits fail the build instead of silently using an older object', () => {
  fixture((root, _, bytes) => {
    writeFileSync(join(root, 'data/items.json'), bytes)
    assert.doesNotThrow(() => getItemsSource(root))
    writeFileSync(join(root, 'data/items.json'), bytes.replace('火', '冰'))
    assert.throws(() => getItemsSource(root), /shadow publish/)
  })
})

test('malformed refs fail instead of constructing a broken public URL', () => {
  fixture((root) => {
    writeFileSync(join(root, '.shadow/refs/data/items.json.ref'), 'version = 1\noid = "sha256:bad"\nsize = 20\n')
    assert.throws(() => getItemsSource(root), /Invalid items.json Shadow ref/)
  })
})
