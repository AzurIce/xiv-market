import type { DataCenter, World } from './types'

/** Immutable, per-report metadata. No global stores or browser APIs. */
export function createWorldDirectory(dataCenters: readonly DataCenter[], worlds: readonly World[]) {
  const nameById = new Map(worlds.map(world => [world.id, world.name]))
  const dcById = new Map<number, string>()
  const dcByName = new Map<string, string>()
  for (const dc of dataCenters) {
    for (const id of dc.worlds) {
      dcById.set(id, dc.name)
      const name = nameById.get(id)
      if (name) dcByName.set(name, dc.name)
    }
  }

  function scopedWorldNames(scope: string): Set<string> {
    const regionDcs = dataCenters.filter(dc => dc.region === scope)
    const dcs = regionDcs.length ? regionDcs : dataCenters.filter(dc => dc.name === scope)
    if (!dcs.length) return new Set([scope])
    return new Set(dcs.flatMap(dc => dc.worlds.flatMap(id => {
      const name = nameById.get(id)
      return name ? [name] : []
    })))
  }

  return {
    dataCenters,
    ready: dataCenters.length > 0 && worlds.length > 0,
    worldName: (id: number) => nameById.get(id) ?? null,
    dcNameById: (id: number) => dcById.get(id) ?? null,
    dcNameByWorldName: (name: string) => dcByName.get(name) ?? null,
    scopedWorldNames,
    filterRows<T extends { worldName?: string }>(rows: T[], scope: string): T[] {
      // Preserve the web page's fallback when metadata could not be loaded.
      if (!dataCenters.length || !worlds.length) return rows
      const names = scopedWorldNames(scope)
      return rows.filter(row => row.worldName
        ? names.has(row.worldName)
        : names.size === 1 && names.has(scope))
    },
  }
}

export type WorldDirectory = ReturnType<typeof createWorldDirectory>
