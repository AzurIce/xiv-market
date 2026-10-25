import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Resolve the committed Shadow ref without downloading the item database. */
export function getItemsSource(root: string) {
  const config = Bun.TOML.parse(readFileSync(join(root, 'shadow.toml'), 'utf-8')) as {
    version: number
    name: string
    backend: { type: string; endpoint: string; bucket: string; prefix?: string }
  }
  const ref = Bun.TOML.parse(readFileSync(join(root, '.shadow/refs/data/items.json.ref'), 'utf-8')) as {
    version: number
    oid: string
    size: number
  }
  const version = JSON.parse(readFileSync(join(root, 'data/items-version.json'), 'utf-8')) as {
    commit: string
    date: string
  }
  if (config.version !== 1 || config.backend?.type !== 'volcengine_tos') {
    throw new Error('Unsupported Shadow configuration')
  }
  const digest = /^sha256:([a-f0-9]{64})$/.exec(ref.oid)?.[1]
  if (ref.version !== 1 || !digest || !Number.isSafeInteger(ref.size) || ref.size <= 0) {
    throw new Error('Invalid items.json Shadow ref; run shadow publish')
  }
  if (!version.commit || !version.date) throw new Error('Missing item version metadata')

  // Reject an unpublished local update rather than building a URL to older data.
  const itemPath = join(root, 'data/items.json')
  if (existsSync(itemPath)) {
    const bytes = readFileSync(itemPath)
    if (bytes.length !== ref.size || createHash('sha256').update(bytes).digest('hex') !== digest) {
      throw new Error('items.json differs from its Shadow ref; run shadow publish before building')
    }
  }

  const { endpoint, bucket, prefix = 'shadow' } = config.backend
  const origin = new URL(endpoint)
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('Shadow TOS endpoint must be an HTTPS origin')
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(bucket)) throw new Error('Invalid TOS bucket name')
  if (!config.name || /[/\\\x00-\x1f]/.test(config.name) || ['.', '..'].includes(config.name)) {
    throw new Error('Invalid Shadow project name')
  }
  if (prefix.startsWith('/') || prefix.endsWith('/') || prefix.split('/').includes('..')) {
    throw new Error('Invalid Shadow prefix')
  }
  const key = [prefix, config.name, 'objects', 'sha256', digest.slice(0, 2), digest.slice(2)]
    .filter(Boolean).map(part => part.split('/').map(encodeURIComponent).join('/')).join('/')
  origin.hostname = `${bucket}.${origin.hostname}`
  origin.pathname = `/${key}`
  return { url: origin.href, sha256: digest, size: ref.size, commit: version.commit, date: version.date }
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const source = getItemsSource(root)
  const output = join(root, 'app/.generated')
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'items-source.json'), JSON.stringify(source, null, 2) + '\n')
  console.log('[Items] Using %s', source.url)
}
