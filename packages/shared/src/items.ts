import { createSignal } from 'solid-js'
import { baseUrl } from './utils'

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

type LegacyItemsPayload = Record<string, ItemInfo>

let itemsCache = new Map<number, ItemInfo>()
let itemsLoaded = false
let itemCount = 0
let loadPromise: Promise<void> | null = null
const [itemsRevision, setItemsRevision] = createSignal(0)

function trackItems() {
  itemsRevision()
}

async function fetchItems() {
  const url = `${baseUrl()}items.json?v=${__BUILD_COMMIT__}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json() as Promise<LegacyItemsPayload>
}

function normalizeItems(payload: LegacyItemsPayload): Map<number, ItemInfo> {
  const map = new Map<number, ItemInfo>()

  for (const [id, info] of Object.entries(payload)) {
    const itemId = Number(id)
    if (itemId && info?.name) {
      map.set(itemId, { name: info.name, icon: Number(info.icon ?? 0) })
    }
  }
  return map
}

export async function loadItems(): Promise<void> {
  if (itemsLoaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      itemsCache = normalizeItems(await fetchItems())
      itemCount = itemsCache.size
      itemsLoaded = true
      console.log('[Items] Loaded %d items (commit: %s)', itemCount, __BUILD_COMMIT__)
    } catch (err) {
      // 失败时不标记 loaded，下次调用 loadItems() 可重试
      console.error('[Items] Failed to load: %s', err instanceof Error ? err.message : err)
      itemsCache = new Map()
      itemCount = 0
    } finally {
      setItemsRevision((version) => version + 1)
    }
  })().finally(() => { loadPromise = null })

  return loadPromise
}

export function getItemsVersionInfo(): ItemsVersionInfo | null {
  trackItems()
  if (!itemsLoaded) return null
  return {
    commit: __BUILD_COMMIT__,
    date: __BUILD_DATE__,
    itemCount,
  }
}

export function getItemInfo(itemId: number): ItemInfo | null {
  trackItems()
  return itemsCache.get(itemId) ?? null
}

export function getAllItems(): { id: number; name: string; icon: number }[] {
  trackItems()
  return Array.from(itemsCache.entries()).map(([id, info]) => ({
    id,
    name: info.name,
    icon: info.icon,
  }))
}

export function getItemName(itemId: number): string {
  trackItems()
  return itemsCache.get(itemId)?.name ?? `物品 #${itemId}`
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
  trackItems()
  return itemsLoaded
}
