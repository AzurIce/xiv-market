import { createSignal, createMemo } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { DataCenter, World } from './types'

export const [selectedRegion, setSelectedRegion] = createSignal('中国')
export const [dataCenters, setDataCenters] = createStore<DataCenter[]>([])
export const [worlds, setWorlds] = createStore<World[]>([])

export const chinaDataCenters = createMemo(() => {
  return dataCenters.filter(dc => dc.region === '中国' || dc.name.includes('中国'))
})

export const availableRegions = createMemo(() => {
  const regions = new Set(dataCenters.map(dc => dc.region))
  return Array.from(regions)
})

const worldMap = createMemo(() => {
  const map = new Map<number, string>()
  for (const w of worlds) {
    map.set(w.id, w.name)
  }
  return map
})

const worldToDcMap = createMemo(() => {
  const map = new Map<number, string>()
  for (const dc of dataCenters) {
    for (const worldId of dc.worlds) {
      map.set(worldId, dc.name)
    }
  }
  return map
})

export function getWorldName(worldId: number): string | null {
  return worldMap().get(worldId) ?? null
}

export function getWorldDcName(worldId: number): string | null {
  return worldToDcMap().get(worldId) ?? null
}

export function getWorldDisplayName(worldId: number): string {
  const world = getWorldName(worldId)
  if (!world) return `服务器 #${worldId}`
  const dc = getWorldDcName(worldId)
  if (dc) return `${dc}·${world}`
  return world
}

const worldNameToDcMap = createMemo(() => {
  const map = new Map<string, string>()
  for (const dc of dataCenters) {
    for (const worldId of dc.worlds) {
      const worldName = worldMap().get(worldId)
      if (worldName) {
        map.set(worldName, dc.name)
      }
    }
  }
  return map
})

export function getWorldDisplayNameByName(worldName: string): string {
  if (!worldName) return ''
  const dc = worldNameToDcMap().get(worldName)
  if (dc) return `${dc}·${worldName}`
  return worldName
}

export function getDcNameByWorldName(worldName: string): string | null {
  return worldNameToDcMap().get(worldName) ?? null
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
  for (const world of worlds) {
    const dcName = worldToDcMap().get(world.id)
    options.push({ type: 'world', value: world.name, label: dcName ? `${dcName}·${world.name}` : world.name })
  }

  return options
}

export function getDefaultScope(): string {
  return selectedRegion()
}
