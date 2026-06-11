import { createEffect, createResource, createSignal, For, lazy, onMount, Show, Suspense } from 'solid-js'
import { A } from '@solidjs/router'
import { selectedRegion, setDataCenters, setWorlds, fetchDataCenters, fetchWorlds } from '@xiv-market/shared'

const RegionSelect = lazy(() => import('./region-select'))

export function Navbar(props: {
  navItems?: { href: string; label: string; end?: boolean }[]
  variant?: 'pro'
  githubUrl?: string
}) {
  const variant = () => props.variant

  const isPro = () => variant() === 'pro'

  const badgeClass = () => 'bg-[rgba(245,158,11,0.15)] text-[#d97706] border-[rgba(245,158,11,0.25)]'
  const [showRegionSelect, setShowRegionSelect] = createSignal(false)

  const [dataCentersRes] = createResource(fetchDataCenters)
  const [worldsRes] = createResource(fetchWorlds)

  onMount(() => {
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    }
    if (win.requestIdleCallback) {
      win.requestIdleCallback(() => setShowRegionSelect(true), { timeout: 1000 })
      return
    }
    window.setTimeout(() => setShowRegionSelect(true), 250)
  })

  createEffect(() => {
    if (dataCentersRes()) setDataCenters(dataCentersRes()!)
  })

  createEffect(() => {
    if (worldsRes()) setWorlds(worldsRes()!)
  })

  return (
    <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex h-14 max-w-7xl mx-auto items-center px-4 sm:px-6 lg:px-8">
        <A href="/" class="mr-6 flex items-center gap-3">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold tracking-tight">
            XIV
          </div>
          <div class="hidden sm:flex items-center gap-2">
            <span class="text-base font-semibold tracking-tight text-foreground">Market</span>
            {isPro() && (
              <span class={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider border ${badgeClass()}`}>
                {variant()}
              </span>
            )}
          </div>
        </A>

        <nav class="flex items-center space-x-6 text-sm font-medium" aria-label="主导航">
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

        <div class="flex flex-1 items-center justify-end space-x-3">
          <div class="flex items-center space-x-2">
            <label for="region-select" class="text-sm text-muted-foreground hidden sm:inline">
              区域
            </label>
            <Show
              when={showRegionSelect()}
              fallback={
                <span class="inline-flex h-8 min-w-16 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs">
                  {selectedRegion()}
                </span>
              }
            >
              <Suspense
                fallback={
                  <span class="inline-flex h-8 min-w-16 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs">
                    {selectedRegion()}
                  </span>
                }
              >
                <RegionSelect />
              </Suspense>
            </Show>
          </div>

          {props.githubUrl && (
            <a
              href={props.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="GitHub"
              title="GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                <path d="M9 18c-4.51 2-5-2-7-2"/>
              </svg>
            </a>
          )}

          <A
            href="/settings"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            activeClass="bg-accent text-accent-foreground"
            end
              aria-label="设置"
              title="设置"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l-.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </A>
        </div>
      </div>
    </header>
  )
}
