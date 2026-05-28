import { createEffect, createResource, For } from 'solid-js'
import { A } from '@solidjs/router'
import { selectedRegion, setSelectedRegion, setDataCenters, setWorlds, availableRegions, fetchDataCenters, fetchWorlds } from '@xiv-market/shared'
import { Select, SelectValue, SelectTrigger, SelectPortal, SelectContent, SelectItem } from '../select'

export function Navbar(props: {
  navItems?: { href: string; label: string; end?: boolean }[]
}) {
  const [dataCentersRes] = createResource(fetchDataCenters)
  const [worldsRes] = createResource(fetchWorlds)

  createEffect(() => {
    if (dataCentersRes()) setDataCenters(dataCentersRes()!)
  })

  createEffect(() => {
    if (worldsRes()) setWorlds(worldsRes()!)
  })

  const regions = () => {
    const available = availableRegions()
    if (available.length > 0) return available
    return ['中国', '日本', '北美', '欧洲', '大洋洲']
  }

  return (
    <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex h-14 max-w-7xl mx-auto items-center px-4 sm:px-6 lg:px-8">
        <A href="/" class="mr-6 flex items-center space-x-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            XIV
          </div>
          <span class="hidden font-bold sm:inline-block">Market</span>
        </A>

        <nav class="flex items-center space-x-6 text-sm font-medium">
          <For each={props.navItems ?? []}>
            {(item) => (
              <A
                href={item.href}
                class="transition-colors hover:text-foreground/80 text-foreground/60"
                activeClass="text-foreground"
                end={item.end}
              >
                {item.label}
              </A>
            )}
          </For>
        </nav>

        <div class="flex flex-1 items-center justify-end space-x-4">
          <div class="flex items-center space-x-2">
            <label for="region-select" class="text-sm text-muted-foreground hidden sm:inline">
              区域
            </label>
            <Select<string>
              options={regions()}
              value={selectedRegion()}
              onChange={(val) => setSelectedRegion(val ?? '中国')}
              itemComponent={(props) => (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              )}
            >
              <SelectTrigger size="sm">
                <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
              </SelectTrigger>
              <SelectPortal>
                <SelectContent />
              </SelectPortal>
            </Select>
          </div>
          <A
            href="/settings"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            activeClass="bg-accent text-accent-foreground"
            end
            title="设置"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </A>
        </div>
      </div>
    </header>
  )
}
