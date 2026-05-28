export interface ItemInfo {
  name: string
  icon: number
}

export interface ItemsVersionInfo {
  commit: string
  date: string
  itemCount: number
}

declare const __BUILD_COMMIT__: string
declare const __BUILD_DATE__: string

import { baseUrl } from './utils'

let itemsCache: Record<string, ItemInfo> | null = null
let loadPromise: Promise<void> | null = null

async function fetchItems() {
  const res = await fetch(`${baseUrl()}items.json?v=${__BUILD_COMMIT__}`)
  if (!res.ok) throw new Error(`${baseUrl()}items.json ${res.status}`)
  return res.json() as Promise<Record<string, ItemInfo>>
}

export async function loadItems(): Promise<void> {
  if (itemsCache !== null) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      itemsCache = await fetchItems()
      console.log('[Items] Loaded %d items (commit: %s)', Object.keys(itemsCache!).length, __BUILD_COMMIT__)
    } catch (err) {
      console.error('[Items] Failed to load: %s', err instanceof Error ? err.message : err)
      itemsCache = {}
    }
  })().finally(() => { loadPromise = null })

  return loadPromise
}

export function getItemsVersionInfo(): ItemsVersionInfo | null {
  if (!itemsCache) return null
  return {
    commit: __BUILD_COMMIT__,
    date: __BUILD_DATE__,
    itemCount: Object.keys(itemsCache).length,
  }
}

export function getItemInfo(itemId: number): ItemInfo | null {
  return itemsCache?.[String(itemId)] ?? null
}

export function getItemName(itemId: number): string {
  if (!itemsCache) return `物品 #${itemId}`
  return itemsCache[String(itemId)]?.name ?? `物品 #${itemId}`
}

export function getIconUrl(iconId: number): string[] {
  if (!iconId) return []
  const folder = Math.floor(iconId / 1000) * 1000
  const paddedFolder = String(folder).padStart(6, '0')
  const paddedFile = String(iconId).padStart(6, '0')
  return [
    `https://xivapi.com/i/${paddedFolder}/${paddedFile}.png`,
    `https://www.garlandtools.org/files/icons/item/t/${iconId}.png`,
    `https://garlandtools.org/files/icons/item/t/${iconId}.png`,
  ]
}

export function getIconUrlString(iconId: number): string {
  const urls = getIconUrl(iconId)
  return urls[0] ?? ''
}

export function getItemIconUrl(itemId: number): string[] {
  const info = getItemInfo(itemId)
  if (!info || !info.icon) return []
  return getIconUrl(info.icon)
}

export function isItemsLoaded(): boolean {
  return itemsCache !== null
}
