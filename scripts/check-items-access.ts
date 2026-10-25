import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { getItemsSource } from './prepare-items'

const source = getItemsSource(resolve(import.meta.dir, '..'))
const origin = 'https://azurice.github.io'
const response = await fetch(source.url, {
  headers: { Origin: origin },
  signal: AbortSignal.timeout(20_000),
})
if (!response.ok) throw new Error(`Public item data request failed: HTTP ${response.status}`)
const allowedOrigin = response.headers.get('access-control-allow-origin')
if (allowedOrigin !== '*' && allowedOrigin !== origin) {
  throw new Error('TOS CORS does not allow https://azurice.github.io to fetch item data')
}
if (!response.headers.get('content-type')?.includes('application/json')) {
  throw new Error('TOS item data must be served as application/json')
}
const bytes = Buffer.from(await response.arrayBuffer())
if (bytes.length !== source.size || createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
  throw new Error('Public item data does not match its Shadow ref')
}
const items = JSON.parse(bytes.toString())
if (!items || typeof items !== 'object' || !Object.values(items).some((item: any) => typeof item?.name === 'string')) {
  throw new Error('Public item data has no item names')
}
console.log('[Items] Public JSON, CORS and SHA-256 verified (%d items)', Object.keys(items).length)
