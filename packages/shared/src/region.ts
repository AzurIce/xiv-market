import { createEffect, createMemo, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { DataCenter, World } from './types'

const REGION_STORAGE_KEY = 'xiv_region'

function loadPersistedRegion(): string {
  try {
    return localStorage.getItem(REGION_STORAGE_KEY) || '中国'
  } catch {
    return '中国'
  }
}

export const [selectedRegion, setSelectedRegion] = createSignal(loadPersistedRegion())

createEffect(() => {
  try {
    localStorage.setItem(REGION_STORAGE_KEY, selectedRegion())
  } catch { /* ignore */ }
})

export const [dataCenters, setDataCenters] = createStore<DataCenter[]>([])
export const [worlds, setWorlds] = createStore<World[]>([])

// 中国大区的玩家俗称
const DC_SHORT_NAMES: Record<string, string> = {
  '陆行鸟': '鸟',
  '莫古力': '猪',
  '猫小胖': '猫',
  '豆豆柴': '狗',
}

export function getDcShortName(dcName: string): string {
  if (!dcName) return ''
  return DC_SHORT_NAMES[dcName] ?? dcName[0]
}

// 中国四大区的全局统一图例色（hex）：鸟=蓝、猫=橙黄、猪=紫、狗=绿。
// 图表等需要 hex 的场景用 getDcColorHex；world-badge.tsx 的 Tailwind 类按相同色相镜像，
// 改色时两边要同步。
const DC_COLOR_HEX: Record<string, string> = {
  '陆行鸟': '#60a5fa', // blue-400
  '猫小胖': '#fbbf24', // amber-400
  '莫古力': '#a78bfa', // violet-400
  '豆豆柴': '#34d399', // emerald-400
}

export function getDcColorHex(dcName: string): string | null {
  return DC_COLOR_HEX[dcName] ?? null
}

export function getChinaDataCenters(): DataCenter[] {
  return dataCenters.filter(dc => dc.region === '中国' || dc.name.includes('中国'))
}

export function availableRegions(): string[] {
  const regions = new Set(dataCenters.map(dc => dc.region))
  return Array.from(regions)
}

const worldNameById = createMemo((): Map<number, string> => {
  const map = new Map<number, string>()
  for (const w of worlds) {
    map.set(w.id, w.name)
  }
  return map
})

const worldDcById = createMemo((): Map<number, string> => {
  const map = new Map<number, string>()
  for (const dc of dataCenters) {
    for (const worldId of dc.worlds) {
      map.set(worldId, dc.name)
    }
  }
  return map
})

export function getWorldName(worldId: number): string | null {
  return worldNameById().get(worldId) ?? null
}

export function getWorldDcName(worldId: number): string | null {
  return worldDcById().get(worldId) ?? null
}

export function getWorldDisplayName(worldId: number): string {
  const world = getWorldName(worldId)
  if (!world) return `服务器 #${worldId}`
  const dc = getWorldDcName(worldId)
  if (dc) return `${dc}·${world}`
  return world
}

const worldDcByName = createMemo((): Map<string, string> => {
  const worldMap = worldNameById()
  const map = new Map<string, string>()
  for (const dc of dataCenters) {
    for (const worldId of dc.worlds) {
      const worldName = worldMap.get(worldId)
      if (worldName) {
        map.set(worldName, dc.name)
      }
    }
  }
  return map
})

export function getWorldDisplayNameByName(worldName: string): string {
  if (!worldName) return ''
  const dc = worldDcByName().get(worldName)
  if (dc) return `${dc}·${worldName}`
  return worldName
}

export function getDcNameByWorldName(worldName: string): string | null {
  return worldDcByName().get(worldName) ?? null
}

export type DataScope = 'region' | 'dc' | 'world'

export interface ScopeOption {
  type: DataScope
  value: string
  label: string
}

export function getAvailableScopes(): ScopeOption[] {
  const options: ScopeOption[] = []
  const regions = new Set<string>()

  // Region level
  for (const dc of dataCenters) {
    if (!regions.has(dc.region)) {
      regions.add(dc.region)
      options.push({ type: 'region', value: dc.region, label: dc.region })
    }
  }

  // DC level
  for (const dc of dataCenters) {
    options.push({ type: 'dc', value: dc.name, label: dc.name })
  }

  // World level
  const worldToDc = worldDcById()
  for (const world of worlds) {
    const dcName = worldToDc.get(world.id)
    options.push({ type: 'world', value: world.name, label: dcName ? `${dcName}·${world.name}` : world.name })
  }

  return options
}

export function getDefaultScope(): string {
  return selectedRegion()
}
